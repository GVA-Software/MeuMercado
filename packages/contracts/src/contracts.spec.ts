import { describe, it, expect } from 'vitest';
import { ReportPriceSchema } from './pricing.js';
import { GeoPointSchema, MoneySchema } from './common.js';
import { RouteRequestSchema } from './geo.js';
import { AddCartItemSchema } from './cart.js';

describe('contratos zod', () => {
  it('aceita GeoPoint válido e rejeita coordenada fora do intervalo', () => {
    expect(GeoPointSchema.safeParse({ lat: -23.55, lng: -46.63 }).success).toBe(true);
    expect(GeoPointSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
  });

  it('Money exige centavos inteiros', () => {
    expect(MoneySchema.safeParse({ cents: 2890, currency: 'BRL' }).success).toBe(true);
    expect(MoneySchema.safeParse({ cents: 28.9, currency: 'BRL' }).success).toBe(false);
  });

  it('ReportPrice rejeita preço não positivo e data futura', () => {
    expect(
      ReportPriceSchema.safeParse({
        produtoId: 'p1',
        mercadoId: 'm1',
        priceCents: 2890,
        source: 'manual',
      }).success,
    ).toBe(true);
    expect(
      ReportPriceSchema.safeParse({
        produtoId: 'p1',
        mercadoId: 'm1',
        priceCents: 0,
        source: 'manual',
      }).success,
    ).toBe(false);
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      ReportPriceSchema.safeParse({
        produtoId: 'p1',
        mercadoId: 'm1',
        priceCents: 100,
        source: 'qr',
        observedAt: futuro,
      }).success,
    ).toBe(false);
  });

  it('AddCartItem aplica default de quantidade = 1', () => {
    const parsed = AddCartItemSchema.parse({
      produtoId: 'p1',
      nome: 'Arroz',
      unitPriceCents: 2890,
    });
    expect(parsed.quantity).toBe(1);
  });

  it('RouteRequest exige origem e destino válidos', () => {
    expect(
      RouteRequestSchema.safeParse({
        from: { lat: -23.5, lng: -46.6 },
        to: { lat: -23.6, lng: -46.7 },
      }).success,
    ).toBe(true);
  });
});
