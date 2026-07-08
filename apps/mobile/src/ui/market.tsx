/**
 * Marca do mercado a partir do nome que vem da nota (razão social) ou do OSM.
 * A NFC-e traz a razão social ("WMS SUPERMERCADOS DO BRASIL LTDA"), então
 * reconhecemos as grandes redes por padrão e, no fallback, limpamos a razão.
 */
const REDES: Array<{ re: RegExp; nome: string; cor: string }> = [
  { re: /atacad[aã]o/i, nome: 'Atacadão', cor: '#E6371F' },
  { re: /assa[ií]/i, nome: 'Assaí', cor: '#F5A800' },
  { re: /carrefour/i, nome: 'Carrefour', cor: '#164193' },
  {
    re: /p[aã]o de a[çc]ucar|companhia brasileira de distrib/i,
    nome: 'Pão de Açúcar',
    cor: '#00A651',
  },
  { re: /\bextra\b/i, nome: 'Extra', cor: '#E2001A' },
  { re: /supermercado dia|\bdia\b/i, nome: 'Dia', cor: '#E2001A' },
  { re: /\btenda\b/i, nome: 'Tenda', cor: '#E2001A' },
  { re: /makro/i, nome: 'Makro', cor: '#003DA5' },
  { re: /sam.?s club/i, nome: "Sam's Club", cor: '#0067A0' },
  { re: /wms supermercados|walmart/i, nome: 'Walmart', cor: '#0071CE' },
  { re: /\bbig\b|bompre[çc]o/i, nome: 'BIG', cor: '#004B93' },
  { re: /nagumo/i, nome: 'Nagumo', cor: '#E4002B' },
  { re: /st\.? marche/i, nome: 'St Marche', cor: '#6E5A46' },
  { re: /oxxo/i, nome: 'Oxxo', cor: '#E4002B' },
  { re: /ampm|am\/pm/i, nome: 'AmPm', cor: '#00539F' },
  { re: /minimercado extra|mercado extra/i, nome: 'Extra Mercado', cor: '#E2001A' },
];

const PALETA = [
  '#E6371F',
  '#F5A800',
  '#164193',
  '#00A651',
  '#7C3AED',
  '#0EA5E9',
  '#DB2777',
  '#0F766E',
];

function corDeterministica(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length]!;
}

export function marcaMercado(nome: string): { label: string; cor: string } {
  for (const r of REDES) if (r.re.test(nome)) return { label: r.nome, cor: r.cor };
  const limpo = nome
    .replace(
      /\b(supermercados?|hipermercado|com[eé]rcio|ltda|s\.?\s?a\.?|epp|-?\s?me|do brasil|eireli|distribui[çc][aã]o|de alimentos)\b/gi,
      '',
    )
    .replace(/[.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const label = (limpo || nome).replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    label: label.length > 24 ? `${label.slice(0, 24)}…` : label,
    cor: corDeterministica(nome),
  };
}

/** Chip colorido com a marca do mercado. */
export function MarketTag({ nome, size = 'sm' }: { nome: string; size?: 'sm' | 'md' }) {
  const { label, cor } = marcaMercado(nome);
  const pad = size === 'md' ? '4px 10px' : '2px 8px';
  const fs = size === 'md' ? 12 : 11;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: `${cor}22`,
        color: cor,
        border: `1px solid ${cor}55`,
        borderRadius: 99,
        padding: pad,
        fontSize: fs,
        fontWeight: 800,
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 99, background: cor, flexShrink: 0 }} />
      {label}
    </span>
  );
}
