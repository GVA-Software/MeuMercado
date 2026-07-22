import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Money, PriceObservation, PriceStatistics } from '@meumercado/domain';
import type {
  EstimativaListaResponse,
  MercadoResumoDTO,
  PriceHistoryDTO,
  PriceSummaryDTO,
  PriceTableRowDTO,
  ProdutoParaCompletarDTO,
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
  async reportar(input: ReportPriceInput, reporterId: string): Promise<PriceSummaryDTO> {
    const obs = new PriceObservation({
      id: randomUUID(),
      produtoId: input.produtoId,
      mercadoId: input.mercadoId,
      mercadoNome: input.mercadoNome,
      ...(input.mercadoEndereco ? { mercadoEndereco: input.mercadoEndereco } : {}),
      ...(input.mercadoLat !== undefined ? { mercadoLat: input.mercadoLat } : {}),
      ...(input.mercadoLng !== undefined ? { mercadoLng: input.mercadoLng } : {}),
      price: Money.fromCents(input.priceCents),
      source: input.source,
      reporterId,
      observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
    });
    await this.repo.add(obs);
    return this.resumo(input.produtoId);
  }

  /** Resumo estatístico de um produto (média regional, mín/máx, tendência). */
  async resumo(produtoId: string, asOf: Date = new Date()): Promise<PriceSummaryDTO> {
    const stats = new PriceStatistics(this.reais(await this.repo.findByProduto(produtoId)));
    return {
      produtoId,
      mediaCents: stats.average()?.cents ?? null,
      minCents: stats.min()?.cents ?? null,
      maxCents: stats.max()?.cents ?? null,
      trend: stats.trendAdaptativo(asOf, TREND_WINDOW_DAYS),
      trendPct: stats.trendPercentAdaptativo(asOf, TREND_WINDOW_DAYS),
      amostras: stats.count,
    };
  }

  /**
   * Prévia do gasto de uma lista (uma leitura só, agrupada em memória). Retorna:
   * a média por produto, o total pela média, os produtos ainda sem preço, E o
   * RANKING de mercados — onde a lista sai mais barata.
   *
   * Cobertura rasa tratada com HONESTIDADE: o total por mercado soma só os itens
   * que ELE tem (preço mais recente × qtd) e devolvemos `itensCobertos` para o app
   * mostrar "cobre k de N"; ordenamos por cobertura (mais completo) e depois preço
   * (mais barato), pra um mercado incompleto não "ganhar" só por ter menos itens.
   */
  async estimativa(
    itens: readonly { produtoId: string; quantity: number }[],
  ): Promise<EstimativaListaResponse> {
    const querido = new Set(itens.map((i) => i.produtoId));
    const porProduto = new Map<string, PriceObservation[]>();
    // produtoId → mercadoId → observação MAIS RECENTE (o preço "de agora" naquele mercado).
    const recentePorMercado = new Map<string, Map<string, PriceObservation>>();
    for (const o of this.reais(await this.repo.all())) {
      if (!querido.has(o.produtoId)) continue;
      const arr = porProduto.get(o.produtoId);
      if (arr) arr.push(o);
      else porProduto.set(o.produtoId, [o]);
      let byMkt = recentePorMercado.get(o.produtoId);
      if (!byMkt) {
        byMkt = new Map();
        recentePorMercado.set(o.produtoId, byMkt);
      }
      const cur = byMkt.get(o.mercadoId);
      if (!cur || o.observedAt.getTime() > cur.observedAt.getTime()) byMkt.set(o.mercadoId, o);
    }

    // Média por produto + total pela média + itens sem preço (como antes).
    const mediaPorProduto = new Map<string, number>();
    let totalEstimadoCents = 0;
    const semPreco: string[] = [];
    const linhas = itens.map((it) => {
      const obs = porProduto.get(it.produtoId);
      const mediaCents =
        obs && obs.length > 0 ? (new PriceStatistics(obs).average()?.cents ?? null) : null;
      if (mediaCents === null) semPreco.push(it.produtoId);
      else {
        totalEstimadoCents += Math.round(mediaCents * it.quantity);
        mediaPorProduto.set(it.produtoId, mediaCents);
      }
      return { produtoId: it.produtoId, mediaCents };
    });

    // Agregação por mercado: total (preço recente × qtd) + média coberta + nº de itens.
    const agg = new Map<
      string,
      { nome: string; total: number; mediaCoberta: number; cobertos: number }
    >();
    for (const it of itens) {
      const byMkt = recentePorMercado.get(it.produtoId);
      if (!byMkt) continue;
      const media = mediaPorProduto.get(it.produtoId);
      for (const [mid, o] of byMkt) {
        let a = agg.get(mid);
        if (!a) {
          a = { nome: o.mercadoNome ?? mid, total: 0, mediaCoberta: 0, cobertos: 0 };
          agg.set(mid, a);
        }
        a.total += o.price.cents * it.quantity;
        if (media !== undefined) a.mediaCoberta += Math.round(media * it.quantity);
        a.cobertos += 1;
      }
    }
    const mercados = [...agg.entries()]
      .map(([mercadoId, a]) => ({
        mercadoId,
        mercadoNome: a.nome,
        totalCents: a.total,
        itensCobertos: a.cobertos,
        economiaVsMediaCents: Math.max(0, a.mediaCoberta - a.total),
      }))
      // Mais completo primeiro; empate → mais barato. (Incompleto não ganha por ter menos.)
      .sort((x, y) => y.itensCobertos - x.itensCobertos || x.totalCents - y.totalCents)
      .slice(0, 5);

    return { itens: linhas, totalEstimadoCents, semPreco, totalItens: itens.length, mercados };
  }

  /**
   * Tabela de preços: cada produto do catálogo com ≥1 preço reportado, com
   * estatística regional. Opcionalmente filtrada por busca. Ordena pelos mais
   * reportados (mais confiáveis) primeiro. Uma leitura só, agrupada em memória.
   */
  async tabela(q?: string, mercado?: string, asOf: Date = new Date()): Promise<PriceTableRowDTO[]> {
    const todas = this.reais(await this.repo.all());
    const observacoes = mercado ? todas.filter((o) => o.mercadoNome === mercado) : todas;
    const porProduto = new Map<string, PriceObservation[]>();
    for (const o of observacoes) {
      const arr = porProduto.get(o.produtoId);
      if (arr) arr.push(o);
      else porProduto.set(o.produtoId, [o]);
    }

    const termo = q?.trim().toLowerCase();
    const rows = (await this.produtos.findAll())
      .map((p): PriceTableRowDTO | null => {
        const obs = porProduto.get(p.id);
        if (!obs || obs.length === 0) return null;
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
          trend: stats.trendAdaptativo(asOf, TREND_WINDOW_DAYS),
          trendPct: stats.trendPercentAdaptativo(asOf, TREND_WINDOW_DAYS),
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

  /**
   * Produtos que a comunidade só tem preço em UM mercado — ainda não dá pra
   * comparar. São o alvo de maior valor para aprofundar a base: um 2º mercado já
   * habilita a comparação. Ordena pelos mais caros (onde comparar rende mais
   * reais); desempata pelos reportados mais recentemente. Ignora observações
   * órfãs (produto que saiu do catálogo).
   */
  async paraCompletar(limit = 30): Promise<ProdutoParaCompletarDTO[]> {
    const porProduto = new Map<string, PriceObservation[]>();
    for (const o of this.reais(await this.repo.all())) {
      const arr = porProduto.get(o.produtoId);
      if (arr) arr.push(o);
      else porProduto.set(o.produtoId, [o]);
    }
    const byId = new Map((await this.produtos.findAll()).map((p) => [p.id, p]));

    const out: ProdutoParaCompletarDTO[] = [];
    for (const [produtoId, obs] of porProduto) {
      if (new Set(obs.map((o) => o.mercadoId)).size !== 1) continue; // já comparável
      const produto = byId.get(produtoId);
      if (!produto) continue; // observação órfã
      const stats = new PriceStatistics(obs);
      const latest = stats.latest();
      out.push({
        produto: produto.toJSON(),
        precoCents: stats.average()?.cents ?? latest?.price.cents ?? 0,
        mercadoNome: latest?.mercadoNome ?? null,
        atualizadoEm: latest?.observedAt.toISOString() ?? null,
      });
    }
    return out
      .sort(
        (a, b) =>
          b.precoCents - a.precoCents || (b.atualizadoEm ?? '').localeCompare(a.atualizadoEm ?? ''),
      )
      .slice(0, limit);
  }

  /** Mercados presentes na base (para o filtro da tabela) — mais reportados primeiro. */
  async mercados(): Promise<MercadoResumoDTO[]> {
    const contagem = new Map<string, number>();
    for (const o of this.reais(await this.repo.all())) {
      if (!o.mercadoNome) continue;
      contagem.set(o.mercadoNome, (contagem.get(o.mercadoNome) ?? 0) + 1);
    }
    return [...contagem]
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Série histórica (ordem cronológica) de um produto — base do gráfico. */
  async historico(produtoId: string): Promise<PriceHistoryDTO> {
    const pontos = this.reais(await this.repo.findByProduto(produtoId))
      .slice()
      .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime())
      .map((o) => ({
        observedAt: o.observedAt.toISOString(),
        priceCents: o.price.cents,
        mercadoId: o.mercadoId,
        mercadoNome: o.mercadoNome ?? null,
        mercadoEndereco: o.mercadoEndereco ?? null,
        mercadoLat: o.mercadoLat ?? null,
        mercadoLng: o.mercadoLng ?? null,
        source: o.source,
      }));
    return { produtoId, pontos };
  }
}
