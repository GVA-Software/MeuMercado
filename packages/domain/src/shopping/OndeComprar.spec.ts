import { describe, expect, it } from 'vitest';
import { melhorMercadoPara, melhoresMercadosPara } from './OndeComprar.js';
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

describe('melhorMercadoPara — melhor mercado por categoria', () => {
  it('agrega vários produtos e ranqueia por vitórias e cobertura', () => {
    const observations = [
      obs({ produtoId: 'p1', mercadoId: 'A', cents: 100, dias: 1 }),
      obs({ produtoId: 'p2', mercadoId: 'A', cents: 200, dias: 1 }),
      obs({ produtoId: 'p1', mercadoId: 'B', cents: 120, dias: 1 }),
    ];
    const r = melhorMercadoPara(observations, ['p1', 'p2'], null);
    expect(r[0]!.mercadoNome).toBe('A');
    expect(r[0]!.vitorias).toBe(2); // mais barato em p1 e p2
    expect(r[0]!.produtosComPreco).toBe(2);
    expect(r[1]!.mercadoNome).toBe('B');
    expect(r[1]!.vitorias).toBe(0);
    expect(r[1]!.produtosComPreco).toBe(1);
  });

  it('ignora observações do seed', () => {
    const observations = [
      obs({ produtoId: 'p1', mercadoId: 'A', cents: 100, dias: 1, reporterId: 'seed' }),
      obs({ produtoId: 'p1', mercadoId: 'B', cents: 120, dias: 1 }),
    ];
    const r = melhorMercadoPara(observations, ['p1'], null);
    expect(r.map((m) => m.mercadoNome)).toEqual(['B']); // A era seed → fora
  });
});
