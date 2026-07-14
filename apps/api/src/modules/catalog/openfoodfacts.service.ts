import { Injectable, Logger } from '@nestjs/common';

interface OffProduct {
  product_name?: string;
  product_name_pt?: string;
  brands?: string;
  quantity?: string;
}

/**
 * Busca o nome de um produto pelo código de barras no **Open Food Facts** — base
 * aberta e gratuita, sem chave (mesma filosofia do OpenStreetMap que já usamos).
 * Feito no servidor (User-Agent correto + cache) e best-effort: nunca lança,
 * devolve `null` quando não encontra. É só uma SUGESTÃO de nome para quando o EAN
 * ainda não está no nosso catálogo.
 */
@Injectable()
export class OpenFoodFactsService {
  private readonly logger = new Logger(OpenFoodFactsService.name);
  private readonly cache = new Map<string, string | null>();

  async nomePorEan(ean: string): Promise<string | null> {
    const cached = this.cache.get(ean);
    if (cached !== undefined) return cached; // `null` = "já buscamos e não achou"
    const nome = await this.buscar(ean);
    this.cache.set(ean, nome);
    return nome;
  }

  private async buscar(ean: string): Promise<string | null> {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json` +
      `?fields=product_name,product_name_pt,brands,quantity`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MeuMercado/1.0 (app de compras)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { status?: number; product?: OffProduct };
      if (data.status !== 1 || !data.product) return null;
      return montarNome(data.product);
    } catch (e) {
      this.logger.warn(`Open Food Facts falhou: ${String(e)}`);
      return null;
    }
  }
}

/**
 * Nome exibível e SEM confundir. A pessoa está comprando 1 unidade, então tiramos
 * ruído de embalagem múltipla ("(6 Unidades)", "6 un", "pack", "leve X pague Y") e
 * só acrescentamos o tamanho quando ele é simples E o nome ainda não tem número
 * (senão duplica, ex.: "1 L … 1 litro").
 */
function montarNome(p: OffProduct): string | null {
  const base = (p.product_name_pt || p.product_name || '')
    .trim()
    .replace(/\(\s*\d+\s*(unidades?|un|x|pack|p[çc]s?|pe[çc]as?)\b[^)]*\)/gi, ' ')
    .replace(/\b\d+\s*unidades?\b/gi, ' ')
    .replace(/\bleve\s+\d+\s+pague\s+\d+\b/gi, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!base) return null;
  const qtd = (p.quantity || '').trim();
  const tamanhoSimples = /^\d+([.,]\d+)?\s*(g|kg|mg|ml|l|lt|litros?)$/i.test(qtd);
  const nome = tamanhoSimples && !/\d/.test(base) ? `${base} ${qtd}` : base;
  return nome.slice(0, 120).trim(); // respeita o limite do contrato (nome máx. 120)
}
