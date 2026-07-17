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

/** Distância de edição (Levenshtein) — quantas letras mudar pra ir de `a` a `b`. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[n]!;
}

/**
 * Casa tolerando ERRO DE DIGITAÇÃO (fuzzy) — 2ª tentativa da busca da Nina, só
 * quando a busca exata não achou nada. Cada palavra do termo (≥4 letras) precisa
 * casar, com distância pequena, alguma palavra do nome do produto. Ex.: "arros"→
 * "arroz", "fejao"→"feijao". Conservador (letras curtas exigem match exato).
 */
export function combinaFuzzy(nome: string, termo: string): boolean {
  const qs = semAcento(termo)
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  if (qs.length === 0) return false;
  const ns = semAcento(nome)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  return qs.every((q) => {
    const max = q.length <= 6 ? 1 : 2;
    return ns.some((w) => Math.abs(w.length - q.length) <= max && levenshtein(w, q) <= max);
  });
}
