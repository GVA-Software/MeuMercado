/**
 * Receitas/eventos → lista de compras. Determinístico (mapa curado, sem LLM). A Nina
 * reconhece "vou fazer um churrasco / um bolo…" e devolve a cesta de itens. As regex
 * batem no texto JÁ normalizado (sem acento, minúsculo). Cresce editando aqui (Fase 4:
 * virar arquivo/dataset).
 */
export interface Receita {
  nome: string;
  itens: string[];
}

const RECEITAS: Array<{ re: RegExp; nome: string; itens: string[] }> = [
  {
    re: /churrasc|churras\b/,
    nome: 'churrasco',
    itens: [
      'carne (picanha/alcatra)',
      'linguiça',
      'pão de alho',
      'carvão',
      'sal grosso',
      'gelo',
      'refrigerante',
      'cerveja',
      'farofa',
      'vinagrete (tomate, cebola)',
    ],
  },
  {
    re: /feijoad/,
    nome: 'feijoada',
    itens: [
      'feijão preto',
      'carne seca',
      'linguiça',
      'costelinha de porco',
      'bacon',
      'arroz',
      'couve',
      'laranja',
      'farofa',
    ],
  },
  {
    re: /\bbolo\b/,
    nome: 'bolo',
    itens: ['farinha de trigo', 'ovos', 'leite', 'açúcar', 'fermento', 'manteiga', 'chocolate em pó'],
  },
  {
    re: /lasanh/,
    nome: 'lasanha',
    itens: ['massa de lasanha', 'molho de tomate', 'queijo mussarela', 'presunto', 'creme de leite'],
  },
  {
    re: /strogonoff|estrogonof/,
    nome: 'strogonoff',
    itens: ['carne (ou frango)', 'creme de leite', 'ketchup', 'mostarda', 'champignon', 'batata palha', 'arroz'],
  },
  {
    re: /macarronad|espaguete|\bmacarrao\b/,
    nome: 'macarronada',
    itens: ['macarrão', 'molho de tomate', 'queijo ralado', 'carne moída', 'cebola', 'alho'],
  },
  {
    re: /\bpizza\b/,
    nome: 'pizza',
    itens: ['massa de pizza', 'molho de tomate', 'queijo mussarela', 'calabresa', 'orégano'],
  },
  {
    re: /panquec/,
    nome: 'panqueca',
    itens: ['farinha de trigo', 'ovos', 'leite', 'molho de tomate', 'queijo', 'carne moída'],
  },
  {
    re: /\bsalad/,
    nome: 'salada',
    itens: ['alface', 'tomate', 'cebola', 'cenoura', 'pepino', 'azeite', 'sal'],
  },
  {
    re: /cafe da manha|\bcafe\b da manha/,
    nome: 'café da manhã',
    itens: ['pão', 'café', 'leite', 'manteiga', 'queijo', 'presunto', 'suco', 'achocolatado'],
  },
  {
    re: /\bsopa\b|caldo verde/,
    nome: 'sopa',
    itens: ['batata', 'cenoura', 'mandioquinha', 'caldo de legumes', 'macarrão', 'frango'],
  },
];

/** Resolve a receita/evento mencionado no texto (normalizado). Null se nenhuma. */
export function montarLista(n: string): Receita | null {
  for (const r of RECEITAS) if (r.re.test(n)) return { nome: r.nome, itens: r.itens };
  return null;
}
