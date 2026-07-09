import { Inject, Injectable } from '@nestjs/common';
import {
  StatisticalInsightEngine,
  type BasketLine,
  type InsightContext,
  type MercadoRef,
  type ProdutoRef,
} from '@meumercado/domain';
import type { InsightDTO, InsightsResponse } from '@meumercado/contracts';
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
    const produtosDeInteresse: ProdutoRef[] = (await this.produtos.findAll()).map((p) => ({
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

    const insights: InsightDTO[] = this.engine.generate(context).map((i) => i.toJSON());

    // Panorama honesto da base — sempre presente quando há dados reais. Também
    // reconcilia "preços" (observações) x "produtos" (itens distintos): são
    // contagens diferentes, pois um mesmo produto pode ter vários preços (datas
    // ou mercados diferentes). Fica por último, como rodapé-resumo da análise.
    if (observations.length > 0) {
      const nMercados = new Set(observations.map((o) => o.mercadoId)).size;
      const nProdutos = new Set(observations.map((o) => o.produtoId)).size;
      const maisCara = observations.reduce((a, b) => (b.price.cents > a.price.cents ? b : a));
      const nomeProd =
        produtosDeInteresse.find((p) => p.id === maisCara.produtoId)?.nome ?? 'um item';
      const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
      const explicaContagem =
        observations.length > nProdutos
          ? `Alguns produtos têm mais de um preço (datas/mercados diferentes), por isso são ${observations.length} preços para ${nProdutos} produtos. `
          : '';
      insights.push({
        type: 'resumo',
        urgente: false,
        emoji: '🧾',
        titulo: `${plural(observations.length, 'preço', 'preços')} · ${plural(nProdutos, 'produto', 'produtos')} · ${plural(nMercados, 'mercado', 'mercados')}`,
        sub: `${explicaContagem}Registre o mesmo item em mais de um mercado para a Nina comparar e achar o mais barato. (Item mais caro até agora: ${nomeProd}.)`,
      });
    }

    return { insights, geradoEm: asOf.toISOString() };
  }
}
