import { Money } from '../money/Money.js';
import { PriceObservation } from '../pricing/PriceObservation.js';
import { PriceStatistics } from '../pricing/PriceStatistics.js';
import { Insight } from './Insight.js';

export interface ProdutoRef {
  readonly id: string;
  readonly nome: string;
  readonly emoji?: string;
}

export interface MercadoRef {
  readonly id: string;
  readonly nome: string;
}

export interface BasketLine {
  readonly produtoId: string;
  readonly nome: string;
  readonly quantity: number;
}

/** Dados de entrada para a geração de insights (montados pela camada de aplicação). */
export interface InsightContext {
  readonly asOf: Date;
  /** Produtos que o usuário costuma comprar (foco dos alertas). */
  readonly produtosDeInteresse: readonly ProdutoRef[];
  readonly mercados: readonly MercadoRef[];
  /** Universo de observações de preço relevantes (várias lojas/datas). */
  readonly observations: readonly PriceObservation[];
  /** Itens do carrinho atual, para otimização de cesta (opcional). */
  readonly cesta?: readonly BasketLine[];
}

export interface InsightEngineConfig {
  readonly windowDays: number;
  readonly trendAlertPct: number;
  readonly minSavings: Money;
}

/**
 * Contrato do motor de insights. Hoje implementado por estatística
 * ({@link StatisticalInsightEngine}); amanhã pode ser trocado por um motor de IA
 * sem tocar no resto do app — basta implementar esta interface.
 */
export interface InsightEngine {
  generate(context: InsightContext): Insight[];
}

const DEFAULT_CONFIG: InsightEngineConfig = {
  windowDays: 30,
  trendAlertPct: 10,
  minSavings: Money.fromReais(1),
};

/** Abaixo disso é ruído/estável; não vira insight de variação. */
const MIN_MOVE_PCT = 2;

/**
 * Motor de insights baseado em estatística — 100% explicável e sem custo de API.
 * Cada método privado é uma "regra" isolada e testável.
 */
export class StatisticalInsightEngine implements InsightEngine {
  private readonly config: InsightEngineConfig;

  constructor(config: Partial<InsightEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  generate(context: InsightContext): Insight[] {
    const insights: Insight[] = [
      ...this.trendAlerts(context),
      ...this.priceMovements(context),
      ...this.cheapestMarketTips(context),
      ...this.historicalLows(context),
    ];
    const basket = this.basketOptimization(context);
    if (basket) insights.push(basket);

    // Urgentes primeiro; depois por maior economia.
    return insights.sort((a, b) => {
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
      return (b.economia?.cents ?? 0) - (a.economia?.cents ?? 0);
    });
  }

  private observationsFor(context: InsightContext, produtoId: string): PriceObservation[] {
    return context.observations.filter((o) => o.produtoId === produtoId);
  }

  /** Média por mercado (na janela recente) para um produto. */
  private averageByMarket(obs: readonly PriceObservation[], asOf: Date): Map<string, Money> {
    const cutoff = asOf.getTime() - this.config.windowDays * 24 * 60 * 60 * 1000;
    const byMarket = new Map<string, { sum: number; n: number }>();
    for (const o of obs) {
      if (o.observedAt.getTime() < cutoff) continue;
      const acc = byMarket.get(o.mercadoId) ?? { sum: 0, n: 0 };
      acc.sum += o.price.cents;
      acc.n += 1;
      byMarket.set(o.mercadoId, acc);
    }
    const result = new Map<string, Money>();
    for (const [mercadoId, { sum, n }] of byMarket) {
      result.set(mercadoId, Money.fromCents(Math.round(sum / n)));
    }
    return result;
  }

  private marketName(context: InsightContext, mercadoId: string): string {
    return context.mercados.find((m) => m.id === mercadoId)?.nome ?? 'outro mercado';
  }

  /** Regra 1: produto de interesse subiu acima do limiar na janela. */
  private trendAlerts(context: InsightContext): Insight[] {
    const out: Insight[] = [];
    for (const produto of context.produtosDeInteresse) {
      const stats = new PriceStatistics(this.observationsFor(context, produto.id));
      const pct = stats.trendPercent(context.asOf, this.config.windowDays);
      if (pct === null) continue;
      if (pct >= this.config.trendAlertPct) {
        out.push(
          new Insight({
            type: 'tendencia-alta',
            urgente: true,
            emoji: produto.emoji ?? '📈',
            titulo: `${produto.nome} subiu ${Math.round(pct)}% recentemente`,
            sub: 'Considere trocar de marca ou aproveitar promoções em maior quantidade.',
            produtoId: produto.id,
          }),
        );
      } else if (pct <= -this.config.trendAlertPct) {
        out.push(
          new Insight({
            type: 'tendencia-baixa',
            urgente: false,
            emoji: produto.emoji ?? '📉',
            titulo: `${produto.nome} caiu ${Math.round(Math.abs(pct))}%`,
            sub: 'Bom momento para comprar em quantidade.',
            produtoId: produto.id,
          }),
        );
      }
    }
    return out;
  }

  /**
   * Regra 1b: variação perceptível de preço (entre o limiar mínimo e o de alerta).
   * Garante que a Nina traga algo útil mesmo com poucos dados / um só mercado —
   * qualquer item registrado em 2+ datas com preço diferente vira um card honesto.
   * (Movimentos ≥ trendAlertPct já são tratados como alerta urgente na Regra 1.)
   */
  private priceMovements(context: InsightContext): Insight[] {
    const out: Insight[] = [];
    for (const produto of context.produtosDeInteresse) {
      const stats = new PriceStatistics(this.observationsFor(context, produto.id));
      const pct = stats.trendPercent(context.asOf, this.config.windowDays);
      if (pct === null) continue;
      const abs = Math.abs(pct);
      if (abs < MIN_MOVE_PCT || abs >= this.config.trendAlertPct) continue;
      const subiu = pct > 0;
      out.push(
        new Insight({
          type: subiu ? 'tendencia-alta' : 'tendencia-baixa',
          urgente: false,
          emoji: produto.emoji ?? (subiu ? '📈' : '📉'),
          titulo: `${produto.nome} ${subiu ? 'subiu' : 'caiu'} ${Math.round(abs)}% nos seus registros`,
          sub: subiu
            ? 'Leve alta entre suas últimas compras — vale comparar antes de estocar.'
            : 'Leve queda entre suas últimas compras — pode ser um bom momento.',
          produtoId: produto.id,
        }),
      );
    }
    return out;
  }

  /** Regra 2: onde o produto está mais barato agora (vs média geral). */
  private cheapestMarketTips(context: InsightContext): Insight[] {
    const out: Insight[] = [];
    for (const produto of context.produtosDeInteresse) {
      const obs = this.observationsFor(context, produto.id);
      const overall = new PriceStatistics(obs).average();
      const byMarket = this.averageByMarket(obs, context.asOf);
      if (overall === null || byMarket.size < 2) continue;

      let cheapestId: string | null = null;
      let cheapest: Money | null = null;
      for (const [mercadoId, avg] of byMarket) {
        if (cheapest === null || avg.isLessThan(cheapest)) {
          cheapest = avg;
          cheapestId = mercadoId;
        }
      }
      if (cheapest === null || cheapestId === null) continue;

      const economia = overall.subtract(cheapest);
      // "pelo menos minSavings" (limiar inclusivo).
      if (!economia.isLessThan(this.config.minSavings)) {
        out.push(
          new Insight({
            type: 'mais-barato-em',
            urgente: false,
            emoji: produto.emoji ?? '🏷️',
            titulo: `${produto.nome} mais barato no ${this.marketName(context, cheapestId)}`,
            sub: `Você economizaria ${economia.format()} por unidade vs a média.`,
            produtoId: produto.id,
            mercadoId: cheapestId,
            economia,
          }),
        );
      }
    }
    return out;
  }

  /** Regra 3: preço atual no menor patamar do histórico. */
  private historicalLows(context: InsightContext): Insight[] {
    const out: Insight[] = [];
    for (const produto of context.produtosDeInteresse) {
      const stats = new PriceStatistics(this.observationsFor(context, produto.id));
      const latest = stats.latest();
      const min = stats.min();
      if (!latest || !min || stats.count < 4) continue;
      if (latest.price.equals(min)) {
        out.push(
          new Insight({
            type: 'menor-preco-historico',
            urgente: false,
            emoji: produto.emoji ?? '⬇️',
            titulo: `${produto.nome} no menor preço do histórico`,
            sub: `Hoje por ${latest.price.format()}. Bom momento para estocar.`,
            produtoId: produto.id,
            mercadoId: latest.mercadoId,
          }),
        );
      }
    }
    return out;
  }

  /**
   * Regra 4 (cesta ótima): compara comprar tudo no melhor mercado único vs
   * distribuir cada item no mercado mais barato. Retorna a economia total.
   */
  private basketOptimization(context: InsightContext): Insight | null {
    const cesta = context.cesta ?? [];
    if (cesta.length === 0) return null;

    // preço (média recente) de cada produto em cada mercado
    const priceOf = new Map<string, Map<string, Money>>();
    for (const line of cesta) {
      priceOf.set(
        line.produtoId,
        this.averageByMarket(this.observationsFor(context, line.produtoId), context.asOf),
      );
    }

    // custo total comprando tudo em UM único mercado (só mercados com todos os itens)
    let bestSingle: Money | null = null;
    for (const mercado of context.mercados) {
      let sum = Money.zero();
      let completo = true;
      for (const line of cesta) {
        const price = priceOf.get(line.produtoId)?.get(mercado.id);
        if (!price) {
          completo = false;
          break;
        }
        sum = sum.add(price.multiply(line.quantity));
      }
      if (completo && (bestSingle === null || sum.isLessThan(bestSingle))) {
        bestSingle = sum;
      }
    }

    // custo distribuindo cada item no mercado mais barato
    let optimal = Money.zero();
    for (const line of cesta) {
      const markets = priceOf.get(line.produtoId);
      if (!markets || markets.size === 0) return null;
      let min: Money | null = null;
      for (const price of markets.values()) {
        if (min === null || price.isLessThan(min)) min = price;
      }
      optimal = optimal.add(min!.multiply(line.quantity));
    }

    if (bestSingle === null) return null;
    const economia = bestSingle.subtract(optimal);
    if (economia.isLessThan(this.config.minSavings)) return null;

    return new Insight({
      type: 'cesta-otima',
      urgente: false,
      emoji: '🛒',
      titulo: 'Combinação ideal de mercados',
      sub: `Distribuindo sua cesta entre mercados você economiza ${economia.format()}.`,
      economia,
    });
  }
}
