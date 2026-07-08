import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Money, PriceObservation, Produto } from '@meumercado/domain';
import type { NfceDraftDTO, NfceImportRequest, NfceImportResult } from '@meumercado/contracts';
import { GeocodeService } from '../geocode/geocode.service.js';
import { PRODUTO_REPOSITORY, type ProdutoRepository } from '../catalog/produtos.repository.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from '../pricing/price-observation.repository.js';
import { SpNfceParser } from './nfce.parser.js';

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

@Injectable()
export class NfceService {
  private readonly logger = new Logger(NfceService.name);
  private readonly parsers: Record<string, SpNfceParser> = { SP: new SpNfceParser() };
  private readonly fantasiaCache = new Map<string, string | null>();

  constructor(
    @Inject(PRODUTO_REPOSITORY) private readonly produtos: ProdutoRepository,
    @Inject(PRICE_OBSERVATION_REPOSITORY) private readonly obs: PriceObservationRepository,
    private readonly geocode: GeocodeService,
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
      throw new UnprocessableEntityException(
        'Não consegui ler os itens deste cupom. Tente novamente ou cadastre manualmente.',
      );
    }

    // Enriquece o mercado: nome fantasia (CNPJ) e coordenada (geocode do endereço).
    // Best-effort e em paralelo — se falhar, seguimos com o que temos.
    const [fantasia, coord] = await Promise.all([
      parsed.mercadoCnpj ? this.nomeFantasia(parsed.mercadoCnpj) : Promise.resolve(null),
      parsed.mercadoEndereco ? this.geocode.geocode(parsed.mercadoEndereco) : Promise.resolve(null),
    ]);

    return {
      uf,
      mercadoNome: fantasia || parsed.mercadoNome,
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
    const mercadoId = req.mercadoId ?? `nfce:${slug(req.mercadoNome)}`;
    const observedAt = req.dataEmissao ? new Date(req.dataEmissao) : new Date();

    // Dedup: linhas idênticas (mesmo SKU/nome e mesmo preço) contam uma vez só.
    const vistos = new Set<string>();
    const itens = req.itens.filter((it) => {
      const k = `${it.codigo ?? it.nome.trim().toLowerCase()}|${it.priceCents}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });

    // Índices para achar o produto existente. Produtos da NF são identificados
    // pelo CÓDIGO do SKU (distingue tamanhos de mesma descrição); os demais, pelo nome.
    const catalogo = await this.produtos.findAll();
    const porCodigo = new Map(
      catalogo.filter((p) => p.codigoExterno).map((p) => [p.codigoExterno, p]),
    );
    const porNome = new Map(
      catalogo.filter((p) => !p.codigoExterno).map((p) => [p.nome.trim().toLowerCase(), p]),
    );

    let produtosCriados = 0;
    for (const item of itens) {
      const codigoExterno = item.codigo ? `${mercadoId}:${item.codigo}` : undefined;
      const nomeKey = item.nome.trim().toLowerCase();
      let produto = codigoExterno ? porCodigo.get(codigoExterno) : porNome.get(nomeKey);
      if (!produto) {
        produto = new Produto({
          id: randomUUID(),
          nome: item.nome.trim(),
          categoria: 'Outros',
          unidade: 'un',
          ...(codigoExterno ? { codigoExterno } : {}),
        });
        await this.produtos.add(produto);
        if (codigoExterno) porCodigo.set(codigoExterno, produto);
        else porNome.set(nomeKey, produto);
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
    }

    return { importados: itens.length, produtosCriados };
  }

  /** Nome fantasia do estabelecimento via BrasilAPI (grátis). Best-effort + cache. */
  private async nomeFantasia(cnpj: string): Promise<string | null> {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return null;
    const cached = this.fantasiaCache.get(digits);
    if (cached !== undefined) return cached;
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        headers: { 'user-agent': 'MeuMercado/1.0 (app de compras)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        this.fantasiaCache.set(digits, null);
        return null;
      }
      const data = (await res.json()) as { nome_fantasia?: string };
      const fantasia = (data.nome_fantasia ?? '').trim() || null;
      this.fantasiaCache.set(digits, fantasia);
      return fantasia;
    } catch (e) {
      this.logger.warn(`CNPJ fantasia falhou: ${String(e)}`);
      return null;
    }
  }

  private detectarUf(url: string): string {
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      throw new BadRequestException('URL inválida.');
    }
    const hit = SEFAZ_DOMINIOS.find((d) => host === d.sufixo || host.endsWith(`.${d.sufixo}`));
    if (!hit) {
      throw new BadRequestException('Isto não parece um QR Code de NFC-e da SEFAZ.');
    }
    return hit.uf;
  }

  private async fetchPagina(url: string): Promise<string> {
    // O portal da SEFAZ oscila (fica lento/indisponível). Tenta algumas vezes
    // antes de desistir — a maioria das falhas é transitória.
    const TENTATIVAS = 3;
    let ultimoErro = '';
    for (let i = 1; i <= TENTATIVAS; i++) {
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9' },
          signal: AbortSignal.timeout(18000),
        });
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
