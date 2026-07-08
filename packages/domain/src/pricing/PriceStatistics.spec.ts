import { describe, it, expect } from 'vitest';
import { PriceStatistics } from './PriceStatistics.js';
import { PriceObservation } from './PriceObservation.js';
import { Money } from '../money/Money.js';

const obs = (reais: number, daysAgo: number, asOf: Date): PriceObservation =>
  new PriceObservation({
    id: `o-${reais}-${daysAgo}`,
    produtoId: 'cafe',
    mercadoId: 'assai',
    price: Money.fromReais(reais),
    source: 'manual',
    reporterId: 'u1',
    observedAt: new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000),
  });

describe('PriceStatistics', () => {
  const asOf = new Date('2025-06-30T12:00:00Z');

  it('calcula média, mínimo e máximo', () => {
    const stats = new PriceStatistics([obs(10, 1, asOf), obs(20, 2, asOf), obs(30, 3, asOf)]);
    expect(stats.average()!.cents).toBe(2000);
    expect(stats.min()!.cents).toBe(1000);
    expect(stats.max()!.cents).toBe(3000);
  });

  it('retorna null sem dados', () => {
    const stats = new PriceStatistics([]);
    expect(stats.average()).toBeNull();
    expect(stats.trendPercent(asOf, 30)).toBeNull();
  });

  it('detecta alta de preço (café subiu ~15%)', () => {
    // janela anterior (30-60 dias): ~12,90 ; janela recente (0-30 dias): ~14,90
    const stats = new PriceStatistics([
      obs(12.9, 50, asOf),
      obs(12.9, 40, asOf),
      obs(14.9, 10, asOf),
      obs(14.9, 5, asOf),
    ]);
    const pct = stats.trendPercent(asOf, 30)!;
    expect(pct).toBeGreaterThan(14);
    expect(pct).toBeLessThan(17);
    expect(stats.trend(asOf, 30)).toBe('subiu');
  });

  it('classifica estável dentro da zona morta', () => {
    const stats = new PriceStatistics([obs(10, 50, asOf), obs(10.1, 10, asOf)]);
    expect(stats.trend(asOf, 30)).toBe('estavel');
  });

  it('não muta a lista de entrada ao ordenar', () => {
    const input = [obs(30, 1, asOf), obs(10, 3, asOf)];
    const copy = [...input];
    new PriceStatistics(input);
    expect(input).toEqual(copy);
  });
});
