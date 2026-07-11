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
  /** Economia mínima (em R$) para sugerir trocar de mercado. */
  readonly minSavings: Money;
  /** Piso relativo (%) para a mesma sugestão — evita "economize 17 centavos". */
  readonly minSavingsPct: number;
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
  // Calibrado com dados reais: itens baratos tornam R$1 alto demais (esconde
  // economias válidas), mas mostrar centavos mata a credibilidade. Piso duplo:
  // ≥ R$0,50 E ≥ 3% do preço → toda dica economiza algo que vale a pena.
  minSavings: Money.fromReais(0.5),
  minSavingsPct: 3,
};

/**
 * Abaixo disso é ruído/estável; não vira insight de variação. Com poucos
 * registros por item, 2% é quase sempre arredondamento/promoção — 3% filtra melhor.
 */
const MIN_MOVE_PCT = 3;

/**
 * Teto do item que o empurrãozinho sugere comparar: a Nina foca em compras do
 * dia a dia. Acima disso costuma ser durável de compra única (ex.: panela), onde
 * comparar preço rende pouco ao longo do tempo — nudge menos crível.
 */
const MAX_COACH_PRICE = Money.fromReais(100);

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
    // Empurrãozinho proativo: quando ainda falta base para comparar, coacha o
    // usuário a completar o dado de maior valor (vira "economize R$X" sozinho
    // quando houver 2+ mercados). Fica por último no array; a UI o destaca.
    const opp = this.opportunity(context);
    if (opp) insights.push(opp);

    // Urgentes primeiro; depois por maior economia.
    return insights.sort((a, b) => {
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
      return (b.economia?.cents ?? 0) - (a.economia?.cents ?? 0);
    });
  }

  private observationsFor(context: InsightContext, produtoId: string): PriceObservation[] {
    return context.observations.filter((o) => o.produtoId === produtoId);
  }

  /**
   * Média por mercado para um produto (todos os registros — sem janela de tempo).
   * Comparar "onde está mais barato" faz sentido mesmo com dados de semanas atrás.
   */
  private averageByMarket(obs: readonly PriceObservation[]): Map<string, Money> {
    const byMarket = new Map<string, { sum: number; n: number }>();
    for (const o of obs) {
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

  /** Regra 1: produto de interesse com variação forte (≥ limiar) entre registros. */
  private trendAlerts(context: InsightContext): Insight[] {
    const out: Insight[] = [];
    for (const produto of context.produtosDeInteresse) {
      const stats = new PriceStatistics(this.observationsFor(context, produto.id));
      const pct = stats.variacaoTotalPct();
      if (pct === null) continue;
      const de = stats.primeira()?.price.format() ?? '';
      const para = stats.latest()?.price.format() ?? '';
      if (pct >= this.config.trendAlertPct) {
        out.push(
          new Insight({
            type: 'tendencia-alta',
            urgente: true,
            emoji: produto.emoji ?? '📈',
            titulo: `${produto.nome} subiu ${Math.round(pct)}%`,
            sub: `Passou de ${de} para ${para} nos seus registros. Antes de repor, vale comparar em outro mercado ou considerar outra marca.`,
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
            sub: `Caiu de ${de} para ${para} nos seus registros. Se você usa com frequência, é um bom momento para comprar em maior quantidade.`,
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
      const pct = stats.variacaoTotalPct();
      if (pct === null) continue;
      const abs = Math.abs(pct);
      if (abs < MIN_MOVE_PCT || abs >= this.config.trendAlertPct) continue;
      const subiu = pct > 0;
      const de = stats.primeira()?.price.format() ?? '';
      const para = stats.latest()?.price.format() ?? '';
      out.push(
        new Insight({
          type: subiu ? 'tendencia-alta' : 'tendencia-baixa',
          urgente: false,
          emoji: produto.emoji ?? (subiu ? '📈' : '📉'),
          titulo: `${produto.nome} ${subiu ? 'subiu' : 'caiu'} ${Math.round(abs)}%`,
          sub: subiu
            ? `Foi de ${de} para ${para} entre seus registros. Alta pequena — confira o preço em outro mercado antes de comprar.`
            : `Foi de ${de} para ${para} entre seus registros. Queda pequena — se for repor, está um pouco mais barato que antes.`,
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
      const byMarket = this.averageByMarket(obs);
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
      const pct = overall.cents > 0 ? (economia.cents / overall.cents) * 100 : 0;
      // Relevante em R$ (≥ minSavings) E em % (≥ minSavingsPct).
      if (!economia.isLessThan(this.config.minSavings) && pct >= this.config.minSavingsPct) {
        out.push(
          new Insight({
            type: 'mais-barato-em',
            urgente: false,
            emoji: produto.emoji ?? '🏷️',
            titulo: `${produto.nome} mais barato no ${this.marketName(context, cheapestId)}`,
            sub: `Sai por ${cheapest.format()} lá — ${economia.format()} abaixo da média dos seus registros (${overall.format()}). É onde vale comprar.`,
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
            sub: `Está em ${latest.price.format()} — o menor que você já registrou. Bom momento para estocar.`,
            produtoId: produto.id,
            mercadoId: latest.mercadoId,
          }),
        );
      }
    }
    return out;
  }

  /**
   * Empurrãozinho (regra proativa): a maior oportunidade de economia AGORA.
   * Escolhe o item de maior valor que só tem preço em UMA loja — é onde
   * comparar rende mais reais — e coacha o usuário a completar a comparação.
   * Quando o item passa a ter 2+ mercados, a regra `cheapestMarketTips` assume
   * com a economia concreta; então este coach some sozinho (sem duplicar).
   */
  private opportunity(context: InsightContext): Insight | null {
    let best: { produto: ProdutoRef; price: Money } | null = null;
    for (const produto of context.produtosDeInteresse) {
      const obs = this.observationsFor(context, produto.id);
      if (obs.length === 0) continue;
      const mercados = new Set(obs.map((o) => o.mercadoId));
      if (mercados.size !== 1) continue; // já dá pra comparar → não é coach
      let max = obs[0]!.price;
      for (const o of obs) if (o.price.isGreaterThan(max)) max = o.price;
      if (max.isGreaterThan(MAX_COACH_PRICE)) continue; // durável de compra única
      if (best === null || max.isGreaterThan(best.price)) best = { produto, price: max };
    }
    if (best === null) return null;
    return new Insight({
      type: 'oportunidade',
      urgente: false,
      emoji: '💡',
      titulo: `Compare o ${best.produto.nome} e economize`,
      sub: `Você só tem 1 preço dele (${best.price.format()}). Anote quanto custa em outro mercado e a Nina te diz na hora onde compensa comprar — nos itens mais caros a comparação rende mais.`,
      produtoId: best.produto.id,
    });
  }

  /**
   * Regra 4 (cesta ótima): compara comprar tudo no melhor mercado único vs
   * distribuir cada item no mercado mais barato. Retorna a economia total.
   */
  private basketOptimization(context: InsightContext): Insight | null {
    const cesta = context.cesta ?? [];
    if (cesta.length === 0) return null;

    // preço (média) de cada produto em cada mercado
    const priceOf = new Map<string, Map<string, Money>>();
    for (const line of cesta) {
      priceOf.set(
        line.produtoId,
        this.averageByMarket(this.observationsFor(context, line.produtoId)),
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
