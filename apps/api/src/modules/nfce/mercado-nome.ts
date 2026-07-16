/**
 * Deriva um nome de mercado amigável a partir do que a NFC-e/BrasilAPI dá (nome
 * fantasia, razão social e o nome cru da SEFAZ). Redes conhecidas viram a MARCA limpa
 * ("CARREFOUR COMERCIO E INDUSTRIA LTDA" → "Carrefour"); o resto é a razão/fantasia
 * limpa (sem "S.A/LTDA", com maiúsculas certas). O ADM ainda pode ajustar no ✏️.
 */

// Redes com razão social que NÃO parece a marca (ou nome cru truncado). Alta confiança.
const MARCAS_MERCADO: Array<[RegExp, string]> = [
  [/CARREFOUR/i, 'Carrefour'],
  [/ATACAD[AÃ]O/i, 'Atacadão'],
  [/\bASSA[IÍ]\b|SENDAS/i, 'Assaí'],
  [/P[AÃ]O DE A[CÇ]UCAR/i, 'Pão de Açúcar'],
  [/WALMART|WAL[ -]MART/i, 'Walmart'],
  [/\bMAKRO\b/i, 'Makro'],
  [/TENDA ATACAD/i, 'Tenda Atacado'],
  [/SAM.?S CLUB/i, "Sam's Club"],
  [/\bEXTRA\b/i, 'Extra'],
];

function marcaMercado(texto: string): string | null {
  for (const [re, marca] of MARCAS_MERCADO) if (re.test(texto)) return marca;
  return null;
}

/** Tira sufixo jurídico (S.A/LTDA/ME…), troca COMPANHIA→Cia e ajusta maiúsculas. */
export function limparNomeMercado(s: string): string {
  const base = s
    .replace(/\s*[-,]?\s*\b(?:S[/.]?A|LTDA|EPP|EIRELI|MEI|ME)\b\.?/gi, ' ')
    .replace(/\bCOMPANHIA\b/gi, 'Cia')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return base
    .toLowerCase()
    .replace(/(^|[\s'-])([a-zà-ú])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    .replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (w) => w.toLowerCase());
}

/** Melhor nome: marca conhecida → fantasia → razão social → nome cru (todos limpos). */
export function melhorNomeMercado(
  fantasia: string | null,
  razao: string | null,
  cru: string | null,
): string {
  const marca = marcaMercado(`${fantasia ?? ''} ${razao ?? ''} ${cru ?? ''}`);
  if (marca) return marca;
  if (fantasia?.trim()) return limparNomeMercado(fantasia);
  if (razao?.trim()) return limparNomeMercado(razao);
  if (cru?.trim()) return limparNomeMercado(cru);
  return 'Mercado';
}
