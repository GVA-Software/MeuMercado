import { describe, it, expect } from 'vitest';
import { StatisticalInsightEngine, InsightContext } from './InsightEngine.js';
import { PriceObservation } from '../pricing/PriceObservation.js';
import { Money } from '../money/Money.js';

const asOf = new Date('2025-06-30T12:00:00Z');
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000);

let seq = 0;
const obs = (produtoId: string, mercadoId: string, reais: number, d: number): PriceObservation =>
  new PriceObservation({
    id: `o${seq++}`,
    produtoId,
    mercadoId,
    price: Money.fromReais(reais),
    source: 'manual',
    reporterId: 'u1',
    observedAt: daysAgo(d),
  });

describe('StatisticalInsightEngine', () => {
  it('gera alerta urgente quando um produto de interesse sobe', () => {
    const engine = new StatisticalInsightEngine();
    const ctx: InsightContext = {
      asOf,
      produtosDeInteresse: [{ id: 'cafe', nome: 'Café Moído 500g', emoji: '☕' }],
      mercados: [{ id: 'assai', nome: 'Assaí' }],
      observations: [
        obs('cafe', 'assai', 12.9, 55),
        obs('cafe', 'assai', 12.9, 45),
        obs('cafe', 'assai', 14.9, 10),
        obs('cafe', 'assai', 14.9, 5),
      ],
    };
    const insights = engine.generate(ctx);
    const alta = insights.find((i) => i.type === 'tendencia-alta');
    expect(alta).toBeDefined();
    expect(alta!.urgente).toBe(true);
    expect(insights[0]!.urgente).toBe(true); // urgentes primeiro
  });

  it('aponta o mercado mais barato para um produto', () => {
    const engine = new StatisticalInsightEngine();
    const ctx: InsightContext = {
      asOf,
      produtosDeInteresse: [{ id: 'arroz', nome: 'Arroz 5kg', emoji: '🌾' }],
      mercados: [
        { id: 'assai', nome: 'Assaí' },
        { id: 'atacadao', nome: 'Atacadão' },
      ],
      observations: [
        obs('arroz', 'assai', 31.5, 10),
        obs('arroz', 'assai', 31.5, 8),
        obs('arroz', 'atacadao', 26.9, 9),
        obs('arroz', 'atacadao', 26.9, 6),
      ],
    };
    const tip = engine.generate(ctx).find((i) => i.type === 'mais-barato-em');
    expect(tip).toBeDefined();
    expect(tip!.mercadoId).toBe('atacadao');
    expect(tip!.economia!.isGreaterThan(Money.zero())).toBe(true);
  });

  it('calcula economia da cesta ótima combinando mercados', () => {
    const engine = new StatisticalInsightEngine();
    const ctx: InsightContext = {
      asOf,
      produtosDeInteresse: [],
      mercados: [
        { id: 'assai', nome: 'Assaí' },
        { id: 'carrefour', nome: 'Carrefour' },
      ],
      observations: [
        // arroz mais barato no Assaí; óleo mais barato no Carrefour
        obs('arroz', 'assai', 27, 5),
        obs('arroz', 'carrefour', 31, 5),
        obs('oleo', 'assai', 8, 5),
        obs('oleo', 'carrefour', 7, 5),
      ],
      cesta: [
        { produtoId: 'arroz', nome: 'Arroz', quantity: 1 },
        { produtoId: 'oleo', nome: 'Óleo', quantity: 1 },
      ],
    };
    const cesta = engine.generate(ctx).find((i) => i.type === 'cesta-otima');
    expect(cesta).toBeDefined();
    // melhor único: Assaí=35 ou Carrefour=38 → 35 ; ótimo: 27+7=34 ; economia=1
    expect(cesta!.economia!.cents).toBe(100);
  });

  it('não inventa insight sem dados suficientes', () => {
    const engine = new StatisticalInsightEngine();
    const insights = engine.generate({
      asOf,
      produtosDeInteresse: [{ id: 'x', nome: 'X' }],
      mercados: [],
      observations: [],
    });
    expect(insights).toEqual([]);
  });
});
