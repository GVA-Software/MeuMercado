import { GeoPoint, melhoresMercadosPara, type PriceObservation } from '@meumercado/domain';
import { combinaBusca, semAcento } from '../common/texto.js';

/** Produto mínimo que o QA precisa (id + nome). */
export interface ProdutoLite {
  id: string;
  nome: string;
}

export type Severidade = 'erro' | 'aviso';
export type Lente = 'busca' | 'fluxo' | 'cobertura' | 'copy' | 'edge';

export interface QaAchado {
  produtoId: string;
  produtoNome: string;
  lente: Lente;
  severidade: Severidade;
  problema: string;
}

export interface QaLenteResumo {
  lente: Lente;
  ok: number;
  problemas: number;
}

export interface QaConversaReport {
  totalProdutos: number;
  comPreco: number;
  semPreco: number;
  erros: number;
  avisos: number;
  porLente: QaLenteResumo[];
  achados: QaAchado[];
}

const REFERENCIA = new GeoPoint(-23.55, -46.63); // ponto fixo p/ exercitar distância
const MAX_ACHADOS = 200;

function temControle(s: string): boolean {
  return [...s].some((ch) => ch.charCodeAt(0) < 32);
}

/** Cria uma variante COM acento (troca a 1ª vogal) para testar a busca tolerante. */
function comAcento(s: string): string {
  const map: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', c: 'ç' };
  for (const ch of s) if (map[ch]) return s.replace(ch, map[ch]);
  return s;
}

/** Termos que um usuário realista digitaria para achar o produto. */
function termosDeBusca(nome: string): string[] {
  const limpo = semAcento(nome);
  const palavras = limpo.split(/\s+/).filter((w) => w.length >= 3);
  const termos = new Set<string>([nome, limpo]);
  if (palavras[0]) {
    termos.add(palavras[0]); // 1ª palavra
    termos.add(palavras[0].toUpperCase()); // caixa alta
    termos.add(comAcento(palavras[0])); // variante com acento
  }
  return [...termos];
}

/**
 * QA de conversação da Nina — determinístico, roda a lógica REAL (busca +
 * ranking) para CADA produto do catálogo. Cinco "lentes especialistas":
 * busca, fluxo, cobertura, copy e edge. Como recebe o catálogo inteiro, cobre
 * automaticamente os produtos novos que forem entrando.
 */
export function auditarConversa(
  catalogo: readonly ProdutoLite[],
  observations: readonly PriceObservation[],
): QaConversaReport {
  const achados: QaAchado[] = [];
  const cont: Record<Lente, { ok: number; problemas: number }> = {
    busca: { ok: 0, problemas: 0 },
    fluxo: { ok: 0, problemas: 0 },
    cobertura: { ok: 0, problemas: 0 },
    copy: { ok: 0, problemas: 0 },
    edge: { ok: 0, problemas: 0 },
  };
  const comPrecoIds = new Set(
    observations.filter((o) => o.reporterId !== 'seed').map((o) => o.produtoId),
  );

  const push = (p: ProdutoLite, lente: Lente, severidade: Severidade, problema: string) => {
    if (achados.length < MAX_ACHADOS)
      achados.push({ produtoId: p.id, produtoNome: p.nome, lente, severidade, problema });
  };
  const marcar = (lente: Lente, ok: boolean) => {
    if (ok) cont[lente].ok += 1;
    else cont[lente].problemas += 1;
  };

  for (const p of catalogo) {
    // 🔎 BUSCA — o produto é achável pelos termos que um usuário digitaria.
    let buscaOk = true;
    for (const termo of termosDeBusca(p.nome)) {
      if (!combinaBusca(p.nome, termo)) {
        push(p, 'busca', 'erro', `não é encontrado ao buscar "${termo}"`);
        buscaOk = false;
      }
    }
    marcar('busca', buscaOk);

    // 🧭 FLUXO — o "onde comprar" roda e devolve um ranking coerente.
    let ranked;
    try {
      ranked = melhoresMercadosPara(observations, p.id, REFERENCIA);
    } catch (e) {
      push(
        p,
        'fluxo',
        'erro',
        `quebrou ao ranquear: ${e instanceof Error ? e.message : String(e)}`,
      );
      marcar('fluxo', false);
      continue;
    }
    let fluxoOk = true;
    for (let i = 1; i < ranked.length; i += 1) {
      if (ranked[i]!.priceCents < ranked[i - 1]!.priceCents) {
        push(p, 'fluxo', 'erro', 'mercados fora de ordem (do mais barato ao mais caro)');
        fluxoOk = false;
        break;
      }
    }
    for (const m of ranked) {
      if (m.priceCents <= 0) {
        push(p, 'fluxo', 'erro', `preço inválido no ${m.mercadoNome}`);
        fluxoOk = false;
      }
      if (m.distanciaMetros !== null && m.distanciaMetros < 0) {
        push(p, 'fluxo', 'erro', 'distância negativa');
        fluxoOk = false;
      }
      if (!m.mercadoNome.trim()) {
        push(p, 'fluxo', 'erro', 'mercado sem nome');
        fluxoOk = false;
      }
    }
    if (
      ranked.length > 0 &&
      ranked[0]!.priceCents !== Math.min(...ranked.map((m) => m.priceCents))
    ) {
      push(p, 'fluxo', 'erro', 'o 1º mercado não é o mais barato');
      fluxoOk = false;
    }
    marcar('fluxo', fluxoOk);

    // 🗺️ COBERTURA — coerência entre ter preço e mostrar mercado.
    const temPreco = comPrecoIds.has(p.id);
    let coberturaOk = true;
    if (temPreco && ranked.length === 0) {
      push(p, 'cobertura', 'erro', 'tem preço real mas não aparece nenhum mercado');
      coberturaOk = false;
    }
    if (!temPreco && ranked.length > 0) {
      push(p, 'cobertura', 'erro', 'sem preço real mas ranqueou (seed vazando?)');
      coberturaOk = false;
    }
    marcar('cobertura', coberturaOk);

    // 💬 COPY — o nome rende uma mensagem apresentável.
    let copyOk = true;
    if (p.nome.trim().length === 0) {
      push(p, 'copy', 'erro', 'nome vazio');
      copyOk = false;
    }
    if (p.nome.length > 120) {
      push(p, 'copy', 'aviso', 'nome muito longo (>120)');
      copyOk = false;
    }
    if (temControle(p.nome)) {
      push(p, 'copy', 'erro', 'nome tem caractere de controle');
      copyOk = false;
    }
    if (semAcento(p.nome).replace(/[^a-z0-9]/g, '').length === 0 && p.nome.trim().length > 0) {
      push(p, 'copy', 'aviso', 'nome sem letras/números (só símbolos)');
      copyOk = false;
    }
    marcar('copy', copyOk);
  }

  // 🧪 EDGE — comportamento em entradas-limite (global).
  const edge = (ok: boolean, problema: string) => {
    marcar('edge', ok);
    if (!ok) push({ id: '-', nome: '(global)' }, 'edge', 'erro', problema);
  };
  edge(
    catalogo.every((p) => !combinaBusca(p.nome, '')),
    'busca vazia deveria não casar nada',
  );
  edge(
    melhoresMercadosPara(observations, 'id-que-nao-existe', REFERENCIA).length === 0,
    'produto inexistente deveria dar 0 mercados',
  );
  edge(
    melhoresMercadosPara(observations, catalogo[0]?.id ?? 'x', null).every(
      (m) => m.distanciaMetros === null,
    ),
    'sem localização do usuário, a distância deveria ser nula',
  );

  return {
    totalProdutos: catalogo.length,
    comPreco: catalogo.filter((p) => comPrecoIds.has(p.id)).length,
    semPreco: catalogo.filter((p) => !comPrecoIds.has(p.id)).length,
    erros: achados.filter((a) => a.severidade === 'erro').length,
    avisos: achados.filter((a) => a.severidade === 'aviso').length,
    porLente: (Object.keys(cont) as Lente[]).map((lente) => ({ lente, ...cont[lente] })),
    achados,
  };
}
