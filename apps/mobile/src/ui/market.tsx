import { useTheme } from '../theme/theme';

/**
 * Marca do mercado a partir do nome que vem da nota (razão social) ou do OSM.
 * A NFC-e traz a razão social ("WMS SUPERMERCADOS DO BRASIL LTDA"), então
 * reconhecemos as grandes redes por padrão e, no fallback, limpamos a razão.
 *
 * IMPORTANTE (jurídico): usamos só o NOME da rede (uso nominativo, lícito) —
 * NÃO reproduzimos as cores/identidade visual oficiais de cada bandeira, pra
 * não sugerir vínculo/patrocínio inexistente (trade dress). Os chips usam a
 * paleta neutra do próprio app. Ver [[MARCAS_DISCLAIMER]].
 */
const REDES: Array<{ re: RegExp; nome: string }> = [
  { re: /atacad[aã]o/i, nome: 'Atacadão' },
  { re: /assa[ií]/i, nome: 'Assaí' },
  { re: /carrefour/i, nome: 'Carrefour' },
  { re: /p[aã]o de a[çc]ucar|companhia brasileira de distrib/i, nome: 'Pão de Açúcar' },
  { re: /\bextra\b/i, nome: 'Extra' },
  { re: /supermercado dia|\bdia\b/i, nome: 'Dia' },
  { re: /\btenda\b/i, nome: 'Tenda' },
  { re: /makro/i, nome: 'Makro' },
  { re: /sam.?s club/i, nome: "Sam's Club" },
  { re: /\bbig\b|bompre[çc]o/i, nome: 'BIG' },
  { re: /nagumo/i, nome: 'Nagumo' },
  { re: /st\.? marche/i, nome: 'St Marche' },
  { re: /oxxo/i, nome: 'Oxxo' },
  { re: /ampm|am\/pm/i, nome: 'AmPm' },
  { re: /minimercado extra|mercado extra/i, nome: 'Extra Mercado' },
];

/**
 * Aviso padrão de não-afiliação — os nomes das redes aparecem só para você
 * identificar onde o preço foi visto; o app não tem vínculo com elas.
 */
export const MARCAS_DISCLAIMER =
  'Os nomes de mercados servem só para identificar onde um preço foi informado. ' +
  'O Meu Mercado não é afiliado, patrocinado ou associado a nenhuma dessas redes; ' +
  'as marcas pertencem aos seus respectivos titulares.';

export function marcaMercado(nome: string): { label: string } {
  for (const r of REDES) if (r.re.test(nome)) return { label: r.nome };
  // Razão social sem marca reconhecível: limpa e mostra o texto. O nome fantasia
  // real vem da consulta do CNPJ.
  const limpo = nome
    .replace(
      /\b(supermercados?|hipermercado|com[eé]rcio|ltda|s\.?\s?a\.?|epp|-?\s?me|do brasil|eireli|distribui[çc][aã]o|de alimentos)\b/gi,
      '',
    )
    .replace(/[.,\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const titled = (limpo || nome)
    .split(' ')
    .filter(Boolean)
    .map((w) =>
      w.length <= 3 && w === w.toUpperCase()
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ');
  return { label: titled.length > 22 ? `${titled.slice(0, 22)}…` : titled };
}

/** Chip NEUTRO com o nome do mercado (sem a cor da marca — ver nota acima). */
export function MarketTag({ nome, size = 'sm' }: { nome: string; size?: 'sm' | 'md' }) {
  const { T } = useTheme();
  const { label } = marcaMercado(nome);
  const pad = size === 'md' ? '4px 10px' : '2px 8px';
  const fs = size === 'md' ? 12 : 11;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: T.card,
        color: T.sub,
        border: `1px solid ${T.border}`,
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
      <span style={{ fontSize: fs, flexShrink: 0 }} aria-hidden>
        🏬
      </span>
      {label}
    </span>
  );
}
