/**
 * Busca tolerante de produtos — regra ÚNICA usada no back (repos, Nina, QA) E no
 * front (filtro da tela de Preços). Ignora caixa e acento (o catálogo vem da SEFAZ
 * SEM acento) e entende as ABREVIAÇÕES do cupom: "sabão" acha "SAB.LIQ.PALMOLIVE".
 */

/** minúsculas + sem acentos (ex.: "Pão" → "pao", "Café" → "cafe"). */
export function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Chave normalizada de um produto — CONJUNTO de palavras (sem acento, sem ordem,
 * sem ruído de 1 letra). Serve pra detectar DUPLICATAS de nomes diferentes do
 * cupom: "PAO PANCO 500G FORMA" e "PAO FORMA PANCO 500G U" viram a MESMA chave
 * ("500g forma pao panco"). Marca/tamanho ficam na chave, então "PAO FORMA
 * PULLMAN" e "...PANCO" NÃO colidem.
 */
export function chaveProduto(nome: string): string {
  return [
    ...new Set(
      semAcento(nome)
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2),
    ),
  ]
    .sort()
    .join(' ');
}

export function combinaBusca(nome: string, termo: string): boolean {
  const q = semAcento(termo);
  if (q.length < 2) return false;
  const n = semAcento(nome);
  if (n.includes(q)) return true; // caso normal (substring, sem acento)

  // Abreviação do cupom: a palavra buscada ESTENDE o 1º "pedaço" do nome (a
  // categoria), ex.: "sabao" ⊃ "sab" em "SAB.LIQ...". Só o 1º token — evita que o
  // "REF." de "açúcar REFinado" apareça ao buscar "refrigerante".
  const primeiro = n.split(/[^a-z0-9]+/).find((w) => w.length >= 3);
  if (!primeiro) return false;
  return q.split(/\s+/).some((w) => w.length > primeiro.length && w.startsWith(primeiro));
}
