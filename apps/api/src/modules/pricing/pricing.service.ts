import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Money, PriceObservation, PriceStatistics } from '@meumercado/domain';
import type {
  PriceHistoryDTO,
  PriceSummaryDTO,
  PriceTableRowDTO,
  ReportPriceInput,
} from '@meumercado/contracts';
import { PRODUTO_REPOSITORY, type ProdutoRepository } from '../catalog/produtos.repository.js';
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
    @Inject(PRODUTO_REPOSITORY)
    private readonly produtos: ProdutoRepository,
  ) {}

  /**
   * Só observações REAIS (reportadas por usuários). O seed é dado de demonstração
   * e nunca deve aparecer na tabela/Nina — mesma política honesta da Nina.
   */
  private reais(obs: readonly PriceObservation[]): PriceObservation[] {
    return obs.filter((o) => o.reporterId !== 'seed');
  }

  /**
   * Registra um preço reportado por um usuário. `reporterId` é guardado para
   * reputação/anti-fraude (ver docs/security.md). Retorna o resumo atualizado.
   */
  reportar(input: ReportPriceInput, reporterId: string): PriceSummaryDTO {
    const obs = new PriceObservation({
      id: randomUUID(),
      produtoId: input.produtoId,
      mercadoId: input.mercadoId,
      mercadoNome: input.mercadoNome,
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
    const stats = new PriceStatistics(this.reais(this.repo.findByProduto(produtoId)));
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

  /**
   * Tabela de preços: cada produto do catálogo com ≥1 preço reportado, com
   * estatística regional. Opcionalmente filtrada por busca. Ordena pelos mais
   * reportados (mais confiáveis) primeiro.
   */
  tabela(q?: string, asOf: Date = new Date()): PriceTableRowDTO[] {
    const termo = q?.trim().toLowerCase();
    const rows = this.produtos
      .findAll()
      .map((p): PriceTableRowDTO | null => {
        const obs = this.reais(this.repo.findByProduto(p.id));
        if (obs.length === 0) return null;
        const stats = new PriceStatistics(obs);
        const maisBarata = obs.reduce(
          (acc, o) => (o.price.isLessThan(acc.price) ? o : acc),
          obs[0]!,
        );
        const latest = stats.latest();
        return {
          produto: p.toJSON(),
          mediaCents: stats.average()?.cents ?? null,
          minCents: stats.min()?.cents ?? null,
          maxCents: stats.max()?.cents ?? null,
          trend: stats.trend(asOf, TREND_WINDOW_DAYS),
          trendPct: stats.trendPercent(asOf, TREND_WINDOW_DAYS),
          amostras: stats.count,
          menorPrecoMercado: maisBarata.mercadoNome ?? null,
          atualizadoEm: latest?.observedAt.toISOString() ?? null,
        };
      })
      .filter((r): r is PriceTableRowDTO => r !== null);

    const filtradas = termo
      ? rows.filter((r) => r.produto.nome.toLowerCase().includes(termo))
      : rows;
    return filtradas.sort((a, b) => b.amostras - a.amostras);
  }

  /** Série histórica (ordem cronológica) de um produto — base do gráfico. */
  historico(produtoId: string): PriceHistoryDTO {
    const pontos = this.reais(this.repo.findByProduto(produtoId))
      .slice()
      .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime())
      .map((o) => ({
        observedAt: o.observedAt.toISOString(),
        priceCents: o.price.cents,
        mercadoNome: o.mercadoNome ?? null,
        source: o.source,
      }));
    return { produtoId, pontos };
  }
}
