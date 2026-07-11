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
