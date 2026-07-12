/**
 * Minúsculas + sem acentos — para buscas tolerantes. Assim "café" encontra
 * "CAFE 3 CORACOES" e vice-versa (o catálogo tem itens com e sem acento).
 */
export function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Regra ÚNICA de match de busca de produto — usada pelos repositórios, pela busca
 * da Nina E pelo QA (assim o QA testa a busca real). Ignora caixa e acento e ainda
 * entende as ABREVIAÇÕES do cupom (NFC-e): "sabão" acha "SAB.LIQ.PALMOLIVE",
 * "detergente" acha "DET.LIQ.LIMPOL", "biscoito" acha "BISC.TRAKINAS", etc.
 */
export function combinaBusca(nome: string, termo: string): boolean {
  const q = semAcento(termo);
  if (q.length < 2) return false;
  const n = semAcento(nome);
  if (n.includes(q)) return true; // caso normal (substring)

  // Abreviação do cupom: a palavra buscada ESTENDE o 1º "pedaço" do nome (a
  // categoria), ex.: "sabao" ⊃ "sab" em "SAB.LIQ...". Só o 1º token — evita que o
  // "REF." de "açúcar REFinado" apareça ao buscar "refrigerante".
  const primeiro = n.split(/[^a-z0-9]+/).find((w) => w.length >= 3);
  if (!primeiro) return false;
  return q.split(/\s+/).some((w) => w.length > primeiro.length && w.startsWith(primeiro));
}
