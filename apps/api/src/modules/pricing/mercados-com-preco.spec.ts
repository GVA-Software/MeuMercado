import { describe, it, expect } from 'vitest';
import { Money, PriceObservation } from '@meumercado/domain';
import { agruparMercadosComPreco } from './price-observation.repository.js';

function obs(over: {
  produtoId: string;
  mercadoId: string;
  nome?: string;
  endereco?: string;
  lat?: number;
  lng?: number;
}): PriceObservation {
  return new PriceObservation({
    id: `${over.mercadoId}-${over.produtoId}`,
    produtoId: over.produtoId,
    mercadoId: over.mercadoId,
    price: Money.fromCents(500),
    source: 'qr',
    reporterId: 'u1',
    observedAt: new Date('2026-07-01T00:00:00Z'),
    ...(over.nome !== undefined ? { mercadoNome: over.nome } : {}),
    ...(over.endereco !== undefined ? { mercadoEndereco: over.endereco } : {}),
    ...(over.lat !== undefined ? { mercadoLat: over.lat } : {}),
    ...(over.lng !== undefined ? { mercadoLng: over.lng } : {}),
  });
}

describe('agruparMercadosComPreco', () => {
  it('agrupa por mercado, conta produtos distintos e adota nome/coord da nota', () => {
    const mercados = agruparMercadosComPreco([
      obs({ produtoId: 'p1', mercadoId: 'm1', nome: 'Mercado A', lat: -23.5, lng: -46.6 }),
      obs({ produtoId: 'p2', mercadoId: 'm1' }), // mesma loja, sem repetir os dados
      obs({ produtoId: 'p1', mercadoId: 'm1' }), // produto repetido → não conta 2x
      obs({ produtoId: 'p9', mercadoId: 'm2', nome: 'Mercado B', lat: -23.4, lng: -46.5 }),
    ]);

    const a = mercados.find((m) => m.id === 'm1')!;
    expect(a.nome).toBe('Mercado A');
    expect(a.lat).toBe(-23.5);
    expect(a.precos).toBe(2); // p1 e p2 distintos
    const b = mercados.find((m) => m.id === 'm2')!;
    expect(b.precos).toBe(1);
  });

  it('mercado sem coordenada vem com lat/lng nulos', () => {
    const [m] = agruparMercadosComPreco([obs({ produtoId: 'p1', mercadoId: 'm1', nome: 'X' })]);
    expect(m!.lat).toBeNull();
    expect(m!.lng).toBeNull();
  });
});
