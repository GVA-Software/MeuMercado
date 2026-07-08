import { Inject, Injectable } from '@nestjs/common';
import {
  StatisticalInsightEngine,
  type BasketLine,
  type InsightContext,
  type MercadoRef,
  type ProdutoRef,
} from '@meumercado/domain';
import type { InsightsResponse } from '@meumercado/contracts';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from '../pricing/price-observation.repository.js';
import { PRODUTO_REPOSITORY, type ProdutoRepository } from '../catalog/produtos.repository.js';

@Injectable()
export class InsightsService {
  // Motor plugável: hoje estatístico; amanhã poderia ser um LlmInsightEngine.
  private readonly engine = new StatisticalInsightEngine();

  constructor(
    @Inject(PRICE_OBSERVATION_REPOSITORY) private readonly prices: PriceObservationRepository,
    @Inject(PRODUTO_REPOSITORY) private readonly produtos: ProdutoRepository,
    @Inject(SEED_DATA) private readonly seed: SeedData,
  ) {}

  gerar(cesta?: readonly BasketLine[]): InsightsResponse {
    const asOf = new Date();
    const produtosDeInteresse: ProdutoRef[] = this.produtos.findAll().map((p) => ({
      id: p.id,
      nome: p.nome,
      ...(p.emoji !== undefined ? { emoji: p.emoji } : {}),
    }));
    const mercados: MercadoRef[] = this.seed.mercados.map((m) => ({ id: m.id, nome: m.nome }));

    const context: InsightContext = {
      asOf,
      produtosDeInteresse,
      mercados,
      observations: this.prices.all(),
      ...(cesta && cesta.length > 0 ? { cesta } : {}),
    };

    return {
      insights: this.engine.generate(context).map((i) => i.toJSON()),
      geradoEm: asOf.toISOString(),
    };
  }
}
