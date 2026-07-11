import { GeoPoint } from '../geo/GeoPoint.js';
import { PriceObservation } from '../pricing/PriceObservation.js';

/** Um mercado ranqueado para comprar um produto (preço + distância). */
export interface MercadoRankeado {
  mercadoId: string;
  mercadoNome: string;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  priceCents: number;
  /** Metros até o usuário (null se faltar localização do usuário ou do mercado). */
  distanciaMetros: number | null;
  observedAt: Date;
}

function pontoSeguro(lat?: number, lng?: number): GeoPoint | null {
  if (lat === undefined || lng === undefined) return null;
  try {
    return new GeoPoint(lat, lng);
  } catch {
    return null; // coordenada fora do intervalo — trata como "sem localização"
  }
}

/**
 * "Onde eu compro este produto?" — a partir das observações reais, escolhe o
 * preço MAIS RECENTE por mercado e ordena por preço (mais barato primeiro),
 * desempatando por proximidade e recência. Mostra a distância para o usuário
 * decidir. Retorna TODOS os mercados com preço (a camada de aplicação corta o
 * top N e usa a contagem total para a mensagem de cobertura).
 */
export function melhoresMercadosPara(
  observations: readonly PriceObservation[],
  produtoId: string,
  usuario: GeoPoint | null,
): MercadoRankeado[] {
  const porMercado = new Map<string, PriceObservation>();
  for (const o of observations) {
    if (o.produtoId !== produtoId || o.reporterId === 'seed') continue;
    const atual = porMercado.get(o.mercadoId);
    if (!atual || o.observedAt.getTime() > atual.observedAt.getTime()) {
      porMercado.set(o.mercadoId, o);
    }
  }

  const mercados: MercadoRankeado[] = [];
  for (const o of porMercado.values()) {
    const alvo = pontoSeguro(o.mercadoLat, o.mercadoLng);
    mercados.push({
      mercadoId: o.mercadoId,
      mercadoNome: o.mercadoNome ?? 'Mercado',
      endereco: o.mercadoEndereco ?? null,
      lat: o.mercadoLat ?? null,
      lng: o.mercadoLng ?? null,
      priceCents: o.price.cents,
      distanciaMetros: usuario && alvo ? Math.round(usuario.distanceTo(alvo)) : null,
      observedAt: o.observedAt,
    });
  }

  mercados.sort((a, b) => {
    if (a.priceCents !== b.priceCents) return a.priceCents - b.priceCents;
    const da = a.distanciaMetros ?? Infinity;
    const db = b.distanciaMetros ?? Infinity;
    if (da !== db) return da - db;
    return b.observedAt.getTime() - a.observedAt.getTime();
  });

  return mercados;
}
