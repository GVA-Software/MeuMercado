import { describe, expect, it } from 'vitest';
import { melhoresMercadosPara } from './OndeComprar.js';
import { PriceObservation } from '../pricing/PriceObservation.js';
import { GeoPoint } from '../geo/GeoPoint.js';
import { Money } from '../money/Money.js';

let seq = 0;
const obs = (p: {
  produtoId: string;
  mercadoId: string;
  cents: number;
  dias: number;
  lat?: number;
  lng?: number;
  reporterId?: string;
}) =>
  new PriceObservation({
    id: `o${seq++}`,
    produtoId: p.produtoId,
    mercadoId: p.mercadoId,
    mercadoNome: p.mercadoId,
    ...(p.lat !== undefined ? { mercadoLat: p.lat } : {}),
    ...(p.lng !== undefined ? { mercadoLng: p.lng } : {}),
    price: Money.fromCents(p.cents),
    source: 'manual',
    reporterId: p.reporterId ?? 'u1',
    observedAt: new Date(Date.now() - p.dias * 86_400_000),
  });

describe('melhoresMercadosPara', () => {
  it('ordena por preço (mais barato primeiro) e usa o preço mais recente por mercado', () => {
    const r = melhoresMercadosPara(
      [
        obs({ produtoId: 'p', mercadoId: 'm1', cents: 1500, dias: 10 }), // antigo
        obs({ produtoId: 'p', mercadoId: 'm1', cents: 1800, dias: 1 }), // recente → vale este
        obs({ produtoId: 'p', mercadoId: 'm2', cents: 1600, dias: 2 }),
      ],
      'p',
      null,
    );
    expect(r.map((m) => m.mercadoId)).toEqual(['m2', 'm1']); // 1600 < 1800
    expect(r[0]!.priceCents).toBe(1600);
    expect(r[1]!.priceCents).toBe(1800);
    expect(r[0]!.distanciaMetros).toBeNull(); // sem localização do usuário
  });

  it('calcula a distância quando há localização do usuário e do mercado', () => {
    const usuario = new GeoPoint(-23.55, -46.63); // SP
    const r = melhoresMercadosPara(
      [obs({ produtoId: 'p', mercadoId: 'm1', cents: 1000, dias: 1, lat: -23.56, lng: -46.64 })],
      'p',
      usuario,
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.distanciaMetros).toBeGreaterThan(0);
    expect(r[0]!.distanciaMetros).toBeLessThan(3000); // ~1,4 km
  });

  it('ignora observações do seed e de outros produtos', () => {
    const r = melhoresMercadosPara(
      [
        obs({ produtoId: 'p', mercadoId: 'm1', cents: 1000, dias: 1, reporterId: 'seed' }),
        obs({ produtoId: 'outro', mercadoId: 'm2', cents: 900, dias: 1 }),
      ],
      'p',
      null,
    );
    expect(r).toEqual([]);
  });
});
