import { Money } from '../money/Money.js';
import { PriceObservation } from './PriceObservation.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Direção da tendência de preço de um produto. */
export type Trend = 'subiu' | 'caiu' | 'estavel';

/**
 * Estatísticas de preço calculadas sobre um conjunto de observações de um mesmo
 * produto (opcionalmente já filtradas por mercado/região). É a base tanto da
 * "tabela de preços — média regional" quanto dos insights da Nina. Puro e
 * determinístico: recebe as datas de referência, não usa o relógio interno —
 * o que o torna trivialmente testável.
 */
export class PriceStatistics {
  private readonly observations: readonly PriceObservation[];

  constructor(observations: readonly PriceObservation[]) {
    // Ordena por data ascendente (cópia — não muta a entrada).
    this.observations = [...observations].sort(
      (a, b) => a.observedAt.getTime() - b.observedAt.getTime(),
    );
    Object.freeze(this);
  }

  get count(): number {
    return this.observations.length;
  }

  private static averageOf(list: readonly PriceObservation[]): Money | null {
    if (list.length === 0) return null;
    const totalCents = list.reduce((sum, o) => sum + o.price.cents, 0);
    return Money.fromCents(Math.round(totalCents / list.length));
  }

  /** Média (regional) de todas as observações. `null` se não houver dados. */
  average(): Money | null {
    return PriceStatistics.averageOf(this.observations);
  }

  min(): Money | null {
    if (this.observations.length === 0) return null;
    return this.observations.reduce(
      (acc, o) => (o.price.isLessThan(acc) ? o.price : acc),
      this.observations[0]!.price,
    );
  }

  max(): Money | null {
    if (this.observations.length === 0) return null;
    return this.observations.reduce(
      (acc, o) => (o.price.isGreaterThan(acc) ? o.price : acc),
      this.observations[0]!.price,
    );
  }

  /** Observação mais recente. */
  latest(): PriceObservation | null {
    return this.observations.length > 0 ? this.observations[this.observations.length - 1]! : null;
  }

  /**
   * Variação % do PRIMEIRO ao ÚLTIMO registro (independe de janela de tempo).
   * Robusto para dados antigos: enquanto houver 2+ registros em datas diferentes,
   * a Nina consegue apontar a variação. `null` se não der para comparar.
   */
  variacaoTotalPct(): number | null {
    if (this.observations.length < 2) return null;
    const primeiro = this.observations[0]!;
    const ultimo = this.observations[this.observations.length - 1]!;
    if (primeiro.observedAt.getTime() === ultimo.observedAt.getTime()) return null;
    const de = primeiro.price.cents;
    if (de === 0) return null;
    return ((ultimo.price.cents - de) / de) * 100;
  }

  private windowAverage(asOf: Date, startDaysAgo: number, endDaysAgo: number): Money | null {
    const end = asOf.getTime() - endDaysAgo * DAY_MS;
    const start = asOf.getTime() - startDaysAgo * DAY_MS;
    const inWindow = this.observations.filter((o) => {
      const t = o.observedAt.getTime();
      return t > start && t <= end;
    });
    return PriceStatistics.averageOf(inWindow);
  }

  /**
   * Variação percentual comparando a janela recente (últimos `windowDays`) com a
   * janela anterior de mesmo tamanho. Positivo = subiu; negativo = caiu.
   * Retorna `null` quando não há dados suficientes em alguma das janelas.
   */
  trendPercent(asOf: Date, windowDays: number): number | null {
    const recent = this.windowAverage(asOf, windowDays, 0);
    const previous = this.windowAverage(asOf, windowDays * 2, windowDays);
    if (recent === null || previous === null) return null;
    return recent.percentageDiffFrom(previous);
  }

  /**
   * Classifica a tendência. `thresholdPct` define a zona morta de "estável"
   * (padrão 3%) para não sinalizar ruído.
   */
  trend(asOf: Date, windowDays: number, thresholdPct = 3): Trend | null {
    const pct = this.trendPercent(asOf, windowDays);
    if (pct === null) return null;
    if (pct > thresholdPct) return 'subiu';
    if (pct < -thresholdPct) return 'caiu';
    return 'estavel';
  }
}
