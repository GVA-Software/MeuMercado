/**
 * Interpretação de intenção da Nina — determinística (regras pt-BR, sem LLM).
 * Classifica a mensagem do usuário e extrai o produto/raio. É a "compreensão"
 * da conversa: distingue saudação, agradecimento, ajuda, refinamento por
 * distância e busca de produto (tirando o "enfeite" da frase).
 */
export type Intencao =
  | { tipo: 'saudacao' }
  | { tipo: 'agradecimento' }
  | { tipo: 'ajuda' }
  | { tipo: 'refinar'; raioMetros: number | null }
  /** "Qual o melhor MERCADO para [categoria]?" — recomenda um mercado, não 1 produto. */
  | { tipo: 'melhor-mercado'; termo: string; raioMetros: number | null }
  | { tipo: 'buscar'; termo: string; raioMetros: number | null };

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const AGRADECIMENTO = /(obrigad|brigad|valeu|vlw|agradec|\bobg\b|\btmj\b|\bgrat[oa]\b|thank)/;
const SAUDACAO = /\b(oi+|ola|opa|e ?ai|salve|bom dia|boa tarde|boa noite|hey|hello|oie)\b/;
const AJUDA = /\b(ajuda|me ajuda|como funciona|como usa|o que (voce|vc) faz|pra que serve)\b/;
const MENCIONA_DISTANCIA = /\b(perto|proxim[oa]s?|raio|distancia|redondezas|redor)\b/;
/** Pergunta sobre MERCADO (recomendar loja), não sobre um produto específico. */
const PERGUNTA_MERCADO = /\bmercado/;
const CUE_RECOMENDA = /(melhor|qual|onde|barat|vale a pena|compensa|indica)/;

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

export function interpretar(texto: string): Intencao {
  const n = norm(texto);
  if (!n) return { tipo: 'buscar', termo: '', raioMetros: null };
  const palavras = n.split(/\s+/);

  if (AGRADECIMENTO.test(n)) return { tipo: 'agradecimento' };
  if (AJUDA.test(n)) return { tipo: 'ajuda' };
  if (SAUDACAO.test(n) && palavras.length <= 4) return { tipo: 'saudacao' };

  const raioMetros = extrairRaio(n);

  // Tira a moldura da pergunta, preserva o miolo (nome do produto).
  let bruto = ` ${n} `;
  for (const re of FILLER) bruto = bruto.replace(re, ' ');
  const tokens = bruto
    .replace(/[?!.,;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length && souBorda(tokens[0]!)) tokens.shift();
  while (tokens.length && souBorda(tokens[tokens.length - 1]!)) tokens.pop();
  const termo = tokens.join(' ');

  if (!termo) {
    if (raioMetros !== null || MENCIONA_DISTANCIA.test(n)) return { tipo: 'refinar', raioMetros };
    return { tipo: 'buscar', termo: '', raioMetros: null };
  }
  // "Qual o melhor MERCADO para [X]?" → recomenda um mercado avaliando a base,
  // em vez de listar tipos de produto. Distingue-se por mencionar "mercado".
  if (PERGUNTA_MERCADO.test(n) && CUE_RECOMENDA.test(n)) {
    return { tipo: 'melhor-mercado', termo, raioMetros };
  }
  return { tipo: 'buscar', termo, raioMetros };
}
