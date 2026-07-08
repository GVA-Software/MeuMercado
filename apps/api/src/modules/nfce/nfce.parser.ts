import * as cheerio from 'cheerio';

export interface ParsedItem {
  descricao: string;
  quantidade?: number;
  unidade?: string;
  unitPriceCents: number;
}

export interface ParsedNfce {
  mercadoNome: string;
  mercadoCnpj?: string;
  dataEmissao?: Date;
  itens: ParsedItem[];
}

/** Estratégia de parsing por UF (cada SEFAZ tem seu HTML). */
export interface NfceParser {
  parse(html: string): ParsedNfce;
}

/** "1.234,56" / "R$ 5,99" / "5,99" → centavos. `null` se não houver número. */
export function reaisParaCents(texto: string): number | null {
  const aposDoisPontos = texto.includes(':') ? texto.slice(texto.lastIndexOf(':') + 1) : texto;
  // A SEFAZ-SP às vezes corta o zero final ("15,9" = R$ 15,90) — aceita 1-2 casas.
  const m = aposDoisPontos.match(/\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2}|\d+/);
  if (!m) return null;
  const v = parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

function primeiroNumero(texto: string): number | undefined {
  const m = texto.replace(/\./g, '').match(/\d+(?:,\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : undefined;
}

/**
 * Parser da NFC-e de São Paulo (portal nfce.fazenda.sp.gov.br). A página de
 * consulta do QR renderiza os itens no HTML (sem captcha). Seletores conhecidos
 * do portal (`#tabResult`, `.txtTit`, `.Rqtd`, `.RvlUnit`) com fallback genérico.
 */
export class SpNfceParser implements NfceParser {
  parse(html: string): ParsedNfce {
    const $ = cheerio.load(html);

    const mercadoNome =
      texto($('.txtTopo').first()) ||
      texto($('#u20').first()) ||
      texto($('h4').first()) ||
      'Mercado (NFC-e)';

    const corpo = $('body').text();
    const cnpj = corpo.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)?.[0];
    const dataStr = corpo.match(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/)?.[0];
    const dataEmissao = dataStr ? parseDataBr(dataStr) : undefined;

    const itens: ParsedItem[] = [];
    $('#tabResult tr').each((_, tr) => {
      const $tr = $(tr);
      const descricao = texto($tr.find('.txtTit, .txtTit2').first());
      if (!descricao) return;
      const unitCents = reaisParaCents(texto($tr.find('.RvlUnit').first()));
      if (unitCents === null || unitCents <= 0) return;
      const quantidade = primeiroNumero(texto($tr.find('.Rqtd').first()));
      const unidade =
        texto($tr.find('.RUN').first())
          .replace(/UN:?\s*/i, '')
          .trim() || undefined;
      itens.push({
        descricao,
        unitPriceCents: unitCents,
        ...(quantidade !== undefined ? { quantidade } : {}),
        ...(unidade ? { unidade } : {}),
      });
    });

    return {
      mercadoNome,
      ...(cnpj ? { mercadoCnpj: cnpj } : {}),
      ...(dataEmissao ? { dataEmissao } : {}),
      itens,
    };
  }
}

/** Texto normalizado de um nó (tipagem estrutural — evita os genéricos do cheerio). */
function texto($el: { text(): string }): string {
  return $el.text().replace(/\s+/g, ' ').trim();
}

function parseDataBr(s: string): Date | undefined {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [, d, mo, y, h, mi, se] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}
