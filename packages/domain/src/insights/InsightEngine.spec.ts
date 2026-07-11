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

  it('empurrãozinho: coacha a comparar o item de maior valor com preço em 1 só loja', () => {
    const engine = new StatisticalInsightEngine();
    const opp = engine
      .generate({
        asOf,
        produtosDeInteresse: [
          { id: 'arroz', nome: 'Arroz 5kg' },
          { id: 'sal', nome: 'Sal 1kg' },
        ],
        mercados: [{ id: 'atacadao', nome: 'Atacadão' }],
        observations: [obs('arroz', 'atacadao', 28, 3), obs('sal', 'atacadao', 3, 3)],
      })
      .find((i) => i.type === 'oportunidade');
    expect(opp).toBeDefined();
    expect(opp!.produtoId).toBe('arroz'); // o de maior valor
    expect(opp!.urgente).toBe(false);
  });

  it('empurrãozinho ignora durável de compra única (acima do teto) e pega o item do dia a dia', () => {
    const engine = new StatisticalInsightEngine();
    const opp = engine
      .generate({
        asOf,
        produtosDeInteresse: [
          { id: 'panela', nome: 'Caldeirão Hotel' },
          { id: 'fralda', nome: 'Fralda Pampers' },
        ],
        mercados: [{ id: 'atacadao', nome: 'Atacadão' }],
        observations: [obs('panela', 'atacadao', 150, 3), obs('fralda', 'atacadao', 89, 3)],
      })
      .find((i) => i.type === 'oportunidade');
    expect(opp).toBeDefined();
    expect(opp!.produtoId).toBe('fralda'); // pulou a panela (R$150 > teto)
  });

  it('não gera empurrãozinho quando o item já dá para comparar (2+ mercados)', () => {
    const engine = new StatisticalInsightEngine();
    const list = engine.generate({
      asOf,
      produtosDeInteresse: [{ id: 'arroz', nome: 'Arroz 5kg' }],
      mercados: [
        { id: 'assai', nome: 'Assaí' },
        { id: 'atacadao', nome: 'Atacadão' },
      ],
      observations: [obs('arroz', 'assai', 31, 5), obs('arroz', 'atacadao', 27, 5)],
    });
    expect(list.find((i) => i.type === 'oportunidade')).toBeUndefined();
    // a dica concreta assume no lugar do coach
    expect(list.find((i) => i.type === 'mais-barato-em')).toBeDefined();
  });

  it('não sugere trocar de mercado por economia irrisória (abaixo de 3%)', () => {
    const engine = new StatisticalInsightEngine();
    // média 40,50 · mais barato 40,00 → economia R$0,50 (atinge o piso em R$),
    // mas só 1,2% do preço → o piso relativo (3%) barra a dica.
    const tip = engine
      .generate({
        asOf,
        produtosDeInteresse: [{ id: 'arroz', nome: 'Arroz 5kg' }],
        mercados: [
          { id: 'a', nome: 'A' },
          { id: 'b', nome: 'B' },
        ],
        observations: [obs('arroz', 'a', 41, 5), obs('arroz', 'b', 40, 5)],
      })
      .find((i) => i.type === 'mais-barato-em');
    expect(tip).toBeUndefined();
  });

  it('ignora variação abaixo do piso de ruído (2%) e mostra a partir de 3%', () => {
    const engine = new StatisticalInsightEngine();
    const semMov = engine
      .generate({
        asOf,
        produtosDeInteresse: [{ id: 'cafe', nome: 'Café' }],
        mercados: [{ id: 'a', nome: 'A' }],
        observations: [obs('cafe', 'a', 10, 5), obs('cafe', 'a', 10.2, 3)], // +2%
      })
      .find((i) => i.type === 'tendencia-alta');
    expect(semMov).toBeUndefined();

    const comMov = engine
      .generate({
        asOf,
        produtosDeInteresse: [{ id: 'cafe', nome: 'Café' }],
        mercados: [{ id: 'a', nome: 'A' }],
        observations: [obs('cafe', 'a', 10, 5), obs('cafe', 'a', 10.4, 3)], // +4%
      })
      .find((i) => i.type === 'tendencia-alta');
    expect(comMov).toBeDefined();
    expect(comMov!.urgente).toBe(false); // 4% < 10% → perceptível, não urgente
  });
});
