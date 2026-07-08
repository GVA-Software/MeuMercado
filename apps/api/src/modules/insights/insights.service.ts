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

  async gerar(cesta?: readonly BasketLine[]): Promise<InsightsResponse> {
    const asOf = new Date();
    const produtosDeInteresse: ProdutoRef[] = this.produtos.findAll().map((p) => ({
      id: p.id,
      nome: p.nome,
      ...(p.emoji !== undefined ? { emoji: p.emoji } : {}),
    }));

    // A Nina analisa apenas dados REAIS (preços reportados por usuários), nunca o
    // seed de demonstração. Sem dados reais → nenhum insight (não inventa).
    const observations = (await this.prices.all()).filter((o) => o.reporterId !== 'seed');

    // Nomes de mercado: seed + os mercados REAIS (OSM) presentes nas observações,
    // pelo nome denormalizado — assim a Nina consegue dizer "mais barato no X"
    // mesmo para mercados que não estão no seed.
    const nomePorId = new Map<string, string>(this.seed.mercados.map((m) => [m.id, m.nome]));
    for (const o of observations) {
      if (o.mercadoNome && !nomePorId.has(o.mercadoId)) nomePorId.set(o.mercadoId, o.mercadoNome);
    }
    const mercados: MercadoRef[] = [...nomePorId].map(([id, nome]) => ({ id, nome }));

    const context: InsightContext = {
      asOf,
      produtosDeInteresse,
      mercados,
      observations,
      ...(cesta && cesta.length > 0 ? { cesta } : {}),
    };

    return {
      insights: this.engine.generate(context).map((i) => i.toJSON()),
      geradoEm: asOf.toISOString(),
    };
  }
}
