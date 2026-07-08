import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Money, PriceObservation, PriceStatistics } from '@meumercado/domain';
import type { PriceSummaryDTO, ReportPriceInput } from '@meumercado/contracts';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from './price-observation.repository.js';

/** Janela usada para calcular tendência (dias). */
const TREND_WINDOW_DAYS = 30;

@Injectable()
export class PricingService {
  constructor(
    @Inject(PRICE_OBSERVATION_REPOSITORY)
    private readonly repo: PriceObservationRepository,
  ) {}

  /**
   * Registra um preço reportado por um usuário. `reporterId` é guardado para
   * reputação/anti-fraude (ver docs/security.md). Retorna o resumo atualizado.
   */
  reportar(input: ReportPriceInput, reporterId: string): PriceSummaryDTO {
    const obs = new PriceObservation({
      id: randomUUID(),
      produtoId: input.produtoId,
      mercadoId: input.mercadoId,
      price: Money.fromCents(input.priceCents),
      source: input.source,
      reporterId,
      observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
    });
    this.repo.add(obs);
    return this.resumo(input.produtoId);
  }

  /** Resumo estatístico de um produto (média regional, mín/máx, tendência). */
  resumo(produtoId: string, asOf: Date = new Date()): PriceSummaryDTO {
    const stats = new PriceStatistics(this.repo.findByProduto(produtoId));
    return {
      produtoId,
      mediaCents: stats.average()?.cents ?? null,
      minCents: stats.min()?.cents ?? null,
      maxCents: stats.max()?.cents ?? null,
      trend: stats.trend(asOf, TREND_WINDOW_DAYS),
      trendPct: stats.trendPercent(asOf, TREND_WINDOW_DAYS),
      amostras: stats.count,
    };
  }
}
