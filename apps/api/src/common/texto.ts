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
 * Regra ÚNICA de match de busca de produto (nome contém o termo, ignorando
 * caixa e acento). Usada pelos repositórios E pelo QA de conversa — assim o QA
 * testa exatamente a busca real.
 */
export function combinaBusca(nome: string, termo: string): boolean {
  const t = semAcento(termo);
  return t.length > 0 && semAcento(nome).includes(t);
}
