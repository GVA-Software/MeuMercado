/**
 * Interpretação de intenção da Nina — determinística (regras pt-BR, sem LLM).
 * Classifica a mensagem do usuário e extrai o produto/raio. É a "compreensão"
 * da conversa: distingue saudação, agradecimento, ajuda, refinamento por
 * distância e busca de produto (tirando o "enfeite" da frase).
 */
export type Intencao =
  | { tipo: 'saudacao' }
  | { tipo: 'agradecimento' }
  | { tipo: 'despedida' }
  /** "O que o app faz?", "qual seu nome?", "como funciona?" — sobre o app/a Nina. */
  | { tipo: 'ajuda' }
  /** "Quais mercados perto de mim?" — listar lojas (a Nina manda pro Mapa). */
  | { tipo: 'listar-mercados' }
  /** "Liste os produtos" — aponta pra aba Preços (listar tudo não cabe no chat). */
  | { tipo: 'listar-produtos' }
  /**
   * Pergunta sobre o HISTÓRICO PESSOAL de compras do usuário. `campo`:
   * - `ultima`: resumo da última compra (data, mercado, total, itens);
   * - `mais-caro`: item mais caro que já comprou;
   * - `mais-comprado`: o que mais comprou;
   * - `gasto`: quanto gastou (total);
   * - `gasto-produto`: quanto pagou num produto (`produto`).
   */
  | {
      tipo: 'historico';
      campo: 'ultima' | 'mais-caro' | 'mais-comprado' | 'gasto' | 'gasto-produto';
      produto?: string;
    }
  | { tipo: 'refinar'; raioMetros: number | null }
  /**
   * "Qual o melhor MERCADO para [X]?" — recomenda um mercado, não 1 produto.
   * `termo` = categoria/produto pedido; `null` = pergunta GENÉRICA ("pra minhas
   * compras", "o melhor mercado?") → avalia a base inteira.
   */
  | { tipo: 'melhor-mercado'; termo: string | null; raioMetros: number | null }
  | { tipo: 'buscar'; termo: string; raioMetros: number | null };

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const AGRADECIMENTO = /(obrigad|brigad|valeu|vlw|agradec|\bobg\b|\btmj\b|\bgrat[oa]\b|thank)/;
const DESPEDIDA = /\b(tchau|adeus|falou|xau|flw|fui|ate (mais|logo|breve|a proxima|mais tarde))\b/;
const SAUDACAO = /\b(oi+|ola|opa|e ?ai|salve|bom dia|boa tarde|boa noite|hey|hello|oie)\b/;
const AJUDA =
  /\b(ajuda|me ajuda|como funciona|como (se )?usa|pra que serve|o que (voce|vc|esse app|este app|o app|isso|a nina|essa nina)? ?faz|o que (e|eh) (isso|o app|este app|esse app|o meu mercado|a nina|voce)|qual (o )?(seu|teu) nome|quem (e|eh) (voce|vc|a nina|nina)|voce faz o que)\b/;
const MENCIONA_DISTANCIA = /\b(perto|proxim[oa]s?|raio|distancia|redondezas|redor)\b/;
/** Pergunta sobre MERCADO (recomendar loja), não sobre um produto específico. */
const PERGUNTA_MERCADO = /\bmercado/;
const CUE_RECOMENDA = /(melhor|qual|onde|barat|vale a pena|compensa|indica)/;
/** Pergunta GENÉRICA de compra (sem produto específico) → avaliar a base toda. */
const GENERIC_COMPRA =
  /\b(minhas? compras?|minhas? feiras?|fazer (as |a )?compras?|fazer (a )?feira|feira do mes|compras? do mes|compra do mes|mercado do mes|abastecer|cesta( basica)?)\b/;
/** "Quais MERCADOS perto de mim?" (plural = LISTAR lojas, não recomendar uma). */
const LISTAR_MERCADOS = /\bmercados\b/;
const VER_LISTA = /\b(quais|quantos|lista|ver|mostr|tem|onde|quero)\b/;

/** Frases de "enfeite" (a moldura da pergunta) removidas para achar o produto. */
const FILLER: RegExp[] = [
  /quero comprar/g,
  /quero saber/g,
  /gostaria de comprar/g,
  /gostaria de/g,
  /preciso comprar/g,
  /preciso de/g,
  /(estou|to) procurando/g,
  /onde (eu )?(compro|acho|encontro|tem|vende|vendem|compra|fica mais barato)/g,
  /pra comprar/g,
  /para comprar/g,
  /qual (e )?(o )?(melhor|menor|mais barato)( mercado| preco| lugar| valor)?/g,
  /qual seria (o )?(melhor)?( mercado)?/g,
  /melhor (mercado|preco|lugar|opcao)/g,
  /mais barat[oa]/g,
  /mais em conta/g,
  /(em|num|dentro de) um? raio de \d+\s*\w+/g,
  /a menos de \d+\s*\w+/g,
  /ate \d+\s*\w+/g,
  /raio de \d+\s*\w+/g,
  /num raio de/g,
  /em um raio de/g,
  /perto de mim/g,
  /aqui perto/g,
  /por perto/g,
  /proxim[oa] de mim/g,
  /quanto (custa|ta|esta|e)/g,
  /(o )?preco de/g,
  /(o )?valor de/g,
];

/** Palavras vazias — removidas só nas BORDAS (mantém conectores internos, ex.: "pão de forma"). */
const STOP = new Set([
  'o','a','os','as','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas',
  'pra','para','me','mim','meu','minha','qual','quais','seria','quero','comprar','onde','mercado',
  'mercados','melhor','melhores','mais','barato','barata','perto','proximo','proxima','raio','km',
  'm','metros','e','ou','por','com','que','tem','ver','quanto','custa','preco','valor','aqui','saber',
]); // prettier-ignore

function extrairRaio(n: string): number | null {
  const km = n.match(/(\d+(?:[.,]\d+)?)\s*(km|kms|quilometros?|quilometro)\b/);
  if (km) return Math.round(parseFloat(km[1]!.replace(',', '.')) * 1000);
  const m = n.match(/(\d+)\s*(m|mts?|metros?)\b/);
  if (m) return parseInt(m[1]!, 10);
  return null;
}

function souBorda(w: string): boolean {
  return STOP.has(w) || /^\d+$/.test(w);
}

/** Tira a moldura da pergunta e devolve o miolo (nome do produto). */
function extrairTermo(n: string): string {
  let bruto = ` ${n} `;
  for (const re of FILLER) bruto = bruto.replace(re, ' ');
  const tokens = bruto
    .replace(/[?!.,;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length && souBorda(tokens[0]!)) tokens.shift();
  while (tokens.length && souBorda(tokens[tokens.length - 1]!)) tokens.pop();
  return tokens.join(' ');
}

/** Itens de uma cesta ("arroz, feijão e óleo"): divide por vírgula/"e"/"ou" e limpa cada um. */
function extrairItens(n: string): string[] {
  return n
    .split(/[,;]|\be\b|\bou\b/)
    .map((seg) => extrairTermo(seg))
    .filter((s) => s.length >= 2);
}

/**
 * Perguntas sobre o HISTÓRICO PESSOAL de compras ("minha última compra", "item mais
 * caro", "o que mais comprei", "quanto gastei/paguei"). Determinístico. Devolve null
 * se não for sobre o histórico do usuário.
 */
function interpretarHistorico(n: string): Intencao | null {
  // "o que MAIS comprei" / "mais comprado".
  if (/(mais|que mais) compr|mais comprad/.test(n)) {
    return { tipo: 'historico', campo: 'mais-comprado' };
  }
  // "item MAIS CARO" (das minhas compras / que comprei / paguei).
  if (/mais car[oa]/.test(n) && /\b(compr|gast|paguei|iten|item)/.test(n)) {
    return { tipo: 'historico', campo: 'mais-caro' };
  }
  // "minha ÚLTIMA compra" / "compra recente" (valor, data, onde, itens).
  if (/(ultim[ao]|recente)/.test(n) && /\bcompr/.test(n)) {
    return { tipo: 'historico', campo: 'ultima' };
  }
  // "quanto PAGUEI/GASTEI [em <produto>]".
  const g = n.match(
    /\b(?:paguei|gastei)\b\s*(?:em |no |na |nos |nas |com |de |do |da |num |numa |pel[oa]s? )?(.*)/,
  );
  if (g) {
    const prod = extrairTermo(g[1] ?? '');
    if (prod && !/\b(total|mes|hoje|ao todo|tudo|ate|agora|no total)\b/.test(prod)) {
      return { tipo: 'historico', campo: 'gasto-produto', produto: prod };
    }
    return { tipo: 'historico', campo: 'gasto' };
  }
  if (/\bgastos?\b/.test(n) && /\b(meu|meus|minha|minhas)\b/.test(n)) {
    return { tipo: 'historico', campo: 'gasto' };
  }
  // "minhas compras" / "o que comprei" → resumo da última.
  if (/\bminhas? compras?\b/.test(n) || /\bcomprei\b/.test(n)) {
    return { tipo: 'historico', campo: 'ultima' };
  }
  return null;
}

export function interpretar(texto: string): Intencao {
  const n = norm(texto);
  if (!n) return { tipo: 'buscar', termo: '', raioMetros: null };
  const palavras = n.split(/\s+/);

  if (AGRADECIMENTO.test(n)) return { tipo: 'agradecimento' };
  if (DESPEDIDA.test(n)) return { tipo: 'despedida' };
  if (AJUDA.test(n)) return { tipo: 'ajuda' };
  if (SAUDACAO.test(n) && palavras.length <= 4) return { tipo: 'saudacao' };

  const raioMetros = extrairRaio(n);
  const termo = extrairTermo(n);
  // Quer recomendação de MERCADO: menciona "mercado" OU é uma compra genérica
  // (ex.: "minhas compras", "a feira"), com um gatilho de recomendação.
  const querMercado =
    (PERGUNTA_MERCADO.test(n) || GENERIC_COMPRA.test(n)) && CUE_RECOMENDA.test(n);

  // Histórico PESSOAL ("minha última compra", "quanto gastei"...) — a MENOS que seja
  // claramente uma recomendação de mercado ("qual mercado pra minhas compras hoje").
  if (!querMercado) {
    const hist = interpretarHistorico(n);
    if (hist) return hist;
  }
  // "Liste os produtos" (que NÃO são as minhas compras) → aponta pra aba Preços.
  if (/\b(list[ae]|liste|mostr\w*|ver todos?)\b/.test(n) && /\bprodutos?\b/.test(n) && !/\bcompr/.test(n)) {
    return { tipo: 'listar-produtos' };
  }

  if (!termo) {
    // "Quais MERCADOS (plural) perto de mim?" → listar lojas → manda pro Mapa.
    if (LISTAR_MERCADOS.test(n) && (MENCIONA_DISTANCIA.test(n) || VER_LISTA.test(n))) {
      return { tipo: 'listar-mercados' };
    }
    // Refinar por distância tem prioridade (ex.: "e num raio de 3km?" após buscar).
    if (raioMetros !== null || MENCIONA_DISTANCIA.test(n)) return { tipo: 'refinar', raioMetros };
    // "Qual o melhor mercado?" sem produto → recomendação GENÉRICA (base toda).
    if (querMercado) return { tipo: 'melhor-mercado', termo: null, raioMetros };
    return { tipo: 'buscar', termo: '', raioMetros: null };
  }
  // Pergunta GENÉRICA de compra ("pra minhas compras") → base inteira (ignora o ruído).
  if (querMercado && GENERIC_COMPRA.test(n)) {
    return { tipo: 'melhor-mercado', termo: null, raioMetros };
  }
  // Lista/CESTA (2+ itens: "arroz, feijão, óleo") → recomenda o mercado da cesta,
  // MESMO sem a palavra "mercado". Passa os itens separados por vírgula.
  const itens = extrairItens(n);
  if (itens.length >= 2) {
    return { tipo: 'melhor-mercado', termo: itens.join(', '), raioMetros };
  }
  // "Qual o melhor MERCADO para [X]?" (1 categoria/produto).
  if (querMercado) {
    return { tipo: 'melhor-mercado', termo, raioMetros };
  }
  return { tipo: 'buscar', termo, raioMetros };
}
