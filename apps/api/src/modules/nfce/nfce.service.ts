import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Money,
  PriceObservation,
  Produto,
  chaveProduto,
  sugerirCategoria,
  type Unidade,
} from '@meumercado/domain';
import type {
  CompraItemDTO,
  NfceDraftDTO,
  NfceImportRequest,
  NfceImportResult,
} from '@meumercado/contracts';
import { GeocodeService } from '../geocode/geocode.service.js';
import { melhorNomeMercado } from './mercado-nome.js';
import { ComprasService } from '../compras/compras.service.js';
import { PRODUTO_REPOSITORY, type ProdutoRepository } from '../catalog/produtos.repository.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from '../pricing/price-observation.repository.js';
import { NFCE_IMPORT_REPOSITORY, type NfceImportRepository } from './nfce-import.repository.js';
import { SpNfceParser } from './nfce.parser.js';

/** Extrai a chave de acesso (44 dígitos) da URL do QR (`?p=CHAVE|...`). */
function extrairChave(url: string): string | undefined {
  try {
    const p = new URL(url).searchParams.get('p') ?? '';
    const chave = p.split('|')[0]?.replace(/\D/g, '') ?? '';
    return chave.length === 44 ? chave : undefined;
  } catch {
    return undefined;
  }
}

/** Domínios oficiais da SEFAZ (allowlist anti-SSRF). Só buscamos destes. */
const SEFAZ_DOMINIOS: Array<{ sufixo: string; uf: string }> = [
  { sufixo: 'fazenda.sp.gov.br', uf: 'SP' },
  { sufixo: 'sefaz.rs.gov.br', uf: 'RS' },
  { sufixo: 'fazenda.mg.gov.br', uf: 'MG' },
  { sufixo: 'sefaz.rj.gov.br', uf: 'RJ' },
  { sufixo: 'fazenda.pr.gov.br', uf: 'PR' },
  { sufixo: 'sefaz.ba.gov.br', uf: 'BA' },
  { sufixo: 'sefaz.go.gov.br', uf: 'GO' },
  { sufixo: 'sefaz.pe.gov.br', uf: 'PE' },
  { sufixo: 'sef.sc.gov.br', uf: 'SC' },
];

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Normaliza a unidade lida do cupom ("KG", "UN", "PC"…) para o tipo do domínio. */
function normalizarUnidade(raw?: string): Unidade {
  const u = (raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (u === 'kg') return 'kg';
  if (u === 'g' || u === 'gr') return 'g';
  if (u === 'l' || u === 'lt') return 'L';
  if (u === 'ml') return 'ml';
  if (u === 'dz' || u.startsWith('duz')) return 'duzia';
  if (u === 'pc' || u === 'pct' || u.startsWith('pac')) return 'pacote';
  return 'un';
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'mercado'
  );
}

/**
 * Chave de dedup para notas SEM chave de acesso de 44 dígitos (raro no fluxo do
 * QR). Deriva do conteúdo (usuário + mercado + dia + itens) para que um reenvio da
 * mesma nota não duplique. Per-usuário, para não bloquear notas idênticas de
 * pessoas diferentes.
 */
function chaveSintetica(req: NfceImportRequest, reporterId: string, observedAt: Date): string {
  const itens = req.itens
    .map((i) => `${i.codigo ?? i.nome.trim().toLowerCase()}:${i.priceCents}:${i.quantidade ?? 1}`)
    .sort()
    .join(',');
  const base = `${reporterId}|${req.mercadoId ?? req.mercadoNome}|${observedAt
    .toISOString()
    .slice(0, 10)}|${itens}`;
  return 'syn:' + createHash('sha1').update(base).digest('hex');
}

@Injectable()
export class NfceService {
  private readonly logger = new Logger(NfceService.name);
  private readonly parsers: Record<string, SpNfceParser> = { SP: new SpNfceParser() };
  private readonly fantasiaCache = new Map<
    string,
    { fantasia: string | null; razao: string | null }
  >();

  constructor(
    @Inject(PRODUTO_REPOSITORY) private readonly produtos: ProdutoRepository,
    @Inject(PRICE_OBSERVATION_REPOSITORY) private readonly obs: PriceObservationRepository,
    @Inject(NFCE_IMPORT_REPOSITORY) private readonly imports: NfceImportRepository,
    private readonly geocode: GeocodeService,
    private readonly compras: ComprasService,
  ) {}

  /** Lê a página pública da SEFAZ apontada pelo QR e extrai um rascunho de itens. */
  async preview(url: string): Promise<NfceDraftDTO> {
    const uf = this.detectarUf(url);
    const parser = this.parsers[uf];
    if (!parser) {
      throw new UnprocessableEntityException(
        `Notas de ${uf} ainda não são suportadas — por enquanto só São Paulo. Você pode cadastrar manualmente.`,
      );
    }

    const html = await this.fetchPagina(url);
    const parsed = parser.parse(html);

    if (parsed.itens.length === 0) {
      const titulo = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? '';
      this.logger.warn(`NFC-e ${uf}: 0 itens extraídos (html ${html.length}b, título "${titulo}")`);
      // Nota emitida em contingência / recém-emitida pode ainda não estar
      // autorizada na SEFAZ (sem itens para consultar).
      const pendente = /conting[êe]ncia|n[ãa]o autorizada|pendente|aguardando/i.test(html);
      throw new UnprocessableEntityException(
        pendente
          ? 'Esta nota ainda não foi autorizada pela SEFAZ (emitida em contingência). Tente de novo mais tarde ou cadastre os preços manualmente.'
          : 'Não consegui ler os itens. Se a nota é recente, pode ainda não estar autorizada na SEFAZ — tente mais tarde. Você também pode cadastrar manualmente.',
      );
    }

    // Enriquece o mercado: nome fantasia (CNPJ) e coordenada (geocode do endereço).
    // Best-effort e em paralelo — se falhar, seguimos com o que temos.
    const chave = extrairChave(url);
    const [cnpj, coord, jaImportada] = await Promise.all([
      parsed.mercadoCnpj
        ? this.dadosCnpj(parsed.mercadoCnpj)
        : Promise.resolve({ fantasia: null, razao: null }),
      parsed.mercadoEndereco ? this.geocode.geocode(parsed.mercadoEndereco) : Promise.resolve(null),
      chave ? this.imports.jaImportada(chave) : Promise.resolve(false),
    ]);

    return {
      uf,
      ...(chave ? { chave } : {}),
      ...(jaImportada ? { jaImportada: true } : {}),
      mercadoNome: melhorNomeMercado(cnpj.fantasia, cnpj.razao, parsed.mercadoNome ?? null),
      ...(parsed.mercadoCnpj ? { mercadoCnpj: parsed.mercadoCnpj } : {}),
      ...(parsed.mercadoEndereco ? { mercadoEndereco: parsed.mercadoEndereco } : {}),
      ...(coord ? { mercadoLat: coord.lat, mercadoLng: coord.lng } : {}),
      ...(parsed.dataEmissao ? { dataEmissao: parsed.dataEmissao.toISOString() } : {}),
      itens: parsed.itens.map((i) => ({
        descricao: i.descricao,
        unitPriceCents: i.unitPriceCents,
        ...(i.codigo ? { codigo: i.codigo } : {}),
        ...(i.quantidade !== undefined ? { quantidade: i.quantidade } : {}),
        ...(i.unidade ? { unidade: i.unidade } : {}),
      })),
    };
  }

  /** Confirma a importação: cria produtos (se novos) e uma observação por item. */
  async importar(req: NfceImportRequest, reporterId: string): Promise<NfceImportResult> {
    const chave = req.chave?.replace(/\D/g, '');
    const chaveValida = chave && chave.length === 44 ? chave : undefined;
    const mercadoId = req.mercadoId ?? `nfce:${slug(req.mercadoNome)}`;
    const observedAt = req.dataEmissao ? new Date(req.dataEmissao) : new Date();

    // Trava anti-duplicata ATÔMICA: registra a nota ANTES de gravar qualquer preço.
    // Se já existia (duplo-toque, retry de rede, ou a mesma nota de novo), aborta —
    // sem isto, duas requisições concorrentes passariam pela checagem e duplicariam
    // preços/compra. Notas sem chave de 44 dígitos usam uma chave sintética.
    const dedupKey = chaveValida ?? chaveSintetica(req, reporterId, observedAt);
    if (!(await this.imports.registrar(dedupKey, reporterId))) {
      throw new ConflictException('Esta nota já foi importada antes.');
    }
    try {
      return await this.gravarImportacao(req, reporterId, mercadoId, observedAt);
    } catch (e) {
      // Rollback da trava: se a gravação falhou, libera para o usuário tentar de novo.
      await this.imports.remover(dedupKey).catch(() => {});
      throw e;
    }
  }

  private async gravarImportacao(
    req: NfceImportRequest,
    reporterId: string,
    mercadoId: string,
    observedAt: Date,
  ): Promise<NfceImportResult> {
    // Dedup: linhas idênticas (mesmo SKU/nome e mesmo preço) contam uma vez só.
    const vistos = new Set<string>();
    const itens = req.itens.filter((it) => {
      const k = `${it.codigo ?? it.nome.trim().toLowerCase()}|${it.priceCents}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });

    // Índices para achar o produto existente:
    //  - CÓDIGO do SKU (namespaced por mercado): reimportar a mesma loja reusa o item.
    //  - CHAVE normalizada (conjunto de palavras): reusa o MESMO produto mesmo com
    //    nome diferente entre mercados ("PAO PANCO 500G FORMA" ≡ "PAO FORMA PANCO 500G U").
    const catalogo = await this.produtos.findAll();
    const porCodigo = new Map(
      catalogo.filter((p) => p.codigoExterno).map((p) => [p.codigoExterno, p]),
    );
    const porChave = new Map<string, Produto>();
    for (const p of catalogo) {
      const k = chaveProduto(p.nome);
      if (k && !porChave.has(k)) porChave.set(k, p);
    }

    let produtosCriados = 0;
    const compraItens: CompraItemDTO[] = [];
    for (const item of itens) {
      const codigoExterno = item.codigo ? `${mercadoId}:${item.codigo}` : undefined;
      const chave = chaveProduto(item.nome);
      let produto =
        (codigoExterno ? porCodigo.get(codigoExterno) : undefined) ??
        (chave ? porChave.get(chave) : undefined);
      const unidade = normalizarUnidade(item.unidade);
      if (!produto) {
        produto = new Produto({
          id: randomUUID(),
          nome: item.nome.trim(),
          // Auto-categoriza pelo nome (a NFC-e não traz categoria); cai em 'Outros' só
          // quando o nome abreviado não dá pra reconhecer. Antes era 'Outros' fixo.
          categoria: sugerirCategoria(item.nome.trim()),
          unidade,
          ...(codigoExterno ? { codigoExterno } : {}),
        });
        await this.produtos.add(produto);
        if (codigoExterno) porCodigo.set(codigoExterno, produto);
        if (chave) porChave.set(chave, produto);
        produtosCriados++;
      }
      await this.obs.add(
        new PriceObservation({
          id: randomUUID(),
          produtoId: produto.id,
          mercadoId,
          mercadoNome: req.mercadoNome,
          ...(req.mercadoEndereco ? { mercadoEndereco: req.mercadoEndereco } : {}),
          ...(req.mercadoLat !== undefined ? { mercadoLat: req.mercadoLat } : {}),
          ...(req.mercadoLng !== undefined ? { mercadoLng: req.mercadoLng } : {}),
          price: Money.fromCents(item.priceCents),
          source: 'qr',
          reporterId,
          observedAt,
        }),
      );
      // Quantidade REAL (fracionária p/ itens por peso: 0,348 kg). Antes era
      // arredondada p/ 1, inflando o total da compra e a economia.
      compraItens.push({
        produtoId: produto.id,
        nome: item.nome.trim(),
        unitPriceCents: item.priceCents,
        quantity: item.quantidade && item.quantidade > 0 ? item.quantidade : 1,
        ...(unidade !== 'un' ? { unidade } : {}),
      });
    }

    // A nota importada também vira uma COMPRA no histórico do usuário.
    await this.compras.registrar(reporterId, {
      mercadoId,
      mercadoNome: req.mercadoNome,
      ...(req.mercadoEndereco ? { mercadoEndereco: req.mercadoEndereco } : {}),
      data: observedAt,
      itens: compraItens,
    });

    // A trava (imports.registrar) já foi aplicada atomicamente no início.
    return { importados: itens.length, produtosCriados };
  }

  /** Fantasia + razão social do estabelecimento via BrasilAPI (grátis). Best-effort + cache. */
  private async dadosCnpj(
    cnpj: string,
  ): Promise<{ fantasia: string | null; razao: string | null }> {
    const vazio = { fantasia: null, razao: null };
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return vazio;
    const cached = this.fantasiaCache.get(digits);
    if (cached !== undefined) return cached;
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        headers: { 'user-agent': 'MeuMercado/1.0 (app de compras)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        this.fantasiaCache.set(digits, vazio);
        return vazio;
      }
      const data = (await res.json()) as { nome_fantasia?: string; razao_social?: string };
      const info = {
        fantasia: (data.nome_fantasia ?? '').trim() || null,
        razao: (data.razao_social ?? '').trim() || null,
      };
      this.fantasiaCache.set(digits, info);
      return info;
    } catch (e) {
      this.logger.warn(`CNPJ dados falhou: ${String(e)}`);
      return vazio;
    }
  }

  private detectarUf(url: string): string {
    const hit = SEFAZ_DOMINIOS.find((d) => {
      const host = this.hostname(url);
      return host === d.sufixo || host.endsWith(`.${d.sufixo}`);
    });
    if (!hit) {
      throw new BadRequestException('Isto não parece um QR Code de NFC-e da SEFAZ.');
    }
    return hit.uf;
  }

  private hostname(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      throw new BadRequestException('URL inválida.');
    }
  }

  /** Recusa qualquer host fora da allowlist da SEFAZ (checado a cada redirect). */
  private assertHostSefaz(url: string): void {
    const host = this.hostname(url);
    const ok = SEFAZ_DOMINIOS.some((d) => host === d.sufixo || host.endsWith(`.${d.sufixo}`));
    if (!ok) {
      throw new BadRequestException('Redirecionamento para fora da SEFAZ bloqueado.');
    }
  }

  /**
   * Segue redirects MANUALMENTE, revalidando o host contra a allowlist da SEFAZ a
   * CADA salto. Sem isto, `fetch` segue redirects automaticamente e um open-redirect
   * num domínio SEFAZ poderia pivotar para um host interno (SSRF). Domínios fora da
   * allowlist (incluindo IPs privados, que não são *.gov.br) são recusados.
   */
  private async fetchSeguindoRedirects(url: string, maxSaltos = 5): Promise<Response> {
    let atual = url;
    for (let salto = 0; salto <= maxSaltos; salto++) {
      this.assertHostSefaz(atual);
      const res = await fetch(atual, {
        headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9' },
        redirect: 'manual',
        signal: AbortSignal.timeout(18000),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return res;
        atual = new URL(loc, atual).toString();
        continue;
      }
      return res;
    }
    throw new Error('Redirects demais.');
  }

  private async fetchPagina(url: string): Promise<string> {
    // O portal da SEFAZ oscila (fica lento/indisponível). Tenta algumas vezes
    // antes de desistir — a maioria das falhas é transitória.
    const TENTATIVAS = 3;
    let ultimoErro = '';
    for (let i = 1; i <= TENTATIVAS; i++) {
      try {
        const res = await this.fetchSeguindoRedirects(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      } catch (e) {
        ultimoErro = String(e);
        this.logger.warn(`SEFAZ tentativa ${i}/${TENTATIVAS} falhou: ${ultimoErro}`);
        if (i < TENTATIVAS) await new Promise((r) => setTimeout(r, 800));
      }
    }
    this.logger.warn(`Falha ao buscar SEFAZ (${url}): ${ultimoErro}`);
    throw new ServiceUnavailableException(
      'A SEFAZ não respondeu agora (o portal deles costuma oscilar). Tente de novo em instantes.',
    );
  }
}
