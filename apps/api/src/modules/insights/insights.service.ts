import { Inject, Injectable } from '@nestjs/common';
import {
  GeoPoint,
  StatisticalInsightEngine,
  melhorMercadoPara,
  melhoresMercadosPara,
  type BasketLine,
  type InsightContext,
  type MercadoRef,
  type ProdutoRef,
} from '@meumercado/domain';
import type {
  InsightDTO,
  InsightsResponse,
  MelhorMercadoResponse,
  OndeComprarResponse,
  ProdutoDTO,
} from '@meumercado/contracts';
import { combinaBusca } from '../../common/texto.js';
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

    return { insights, geradoEm: asOf.toISOString() };
  }

  /**
   * Busca de produto da Nina: só produtos que TÊM preço real (com observação de
   * usuário, sem seed). Evita oferecer placeholders do seed que dão em beco sem
   * saída ("ainda não tenho preço") — o que arranha a credibilidade.
   */
  async buscarComPreco(termo: string): Promise<ProdutoDTO[]> {
    const t = termo.trim();
    if (!t) return [];
    const comPreco = new Set(
      (await this.prices.all()).filter((o) => o.reporterId !== 'seed').map((o) => o.produtoId),
    );
    const produtos = await this.produtos.findAll();
    return produtos
      .filter((p) => comPreco.has(p.id) && combinaBusca(p.nome, t))
      .slice(0, 20)
      .map((p) => p.toJSON());
  }

  /**
   * "Onde eu compro este produto?": ranqueia os mercados com preço para o produto
   * por preço + distância. Só dados reais (o filtro de seed está no domínio).
   */
  /**
   * "Qual o melhor mercado para [categoria]?" — casa os produtos COM PREÇO pelo
   * termo (ex.: "limpeza" → todos os LIMP…) e agrega os mercados sobre eles,
   * recomendando onde vale a pena. Honesto com base rasa (poucos multi-mercado).
   */
  async melhorMercado(termo: string, lat?: number, lng?: number): Promise<MelhorMercadoResponse> {
    const t = termo.trim();
    const produtoIds = (await this.buscarComPreco(t)).map((p) => p.id);
    if (produtoIds.length === 0) return { termo: t, totalProdutos: 0, mercados: [] };
    const observations = await this.prices.all();
    const usuario = lat !== undefined && lng !== undefined ? new GeoPoint(lat, lng) : null;
    return {
      termo: t,
      totalProdutos: produtoIds.length,
      mercados: melhorMercadoPara(observations, produtoIds, usuario).slice(0, 3),
    };
  }

  async ondeComprar(produtoId: string, lat?: number, lng?: number): Promise<OndeComprarResponse> {
    const observations = await this.prices.all();
    const usuario = lat !== undefined && lng !== undefined ? new GeoPoint(lat, lng) : null;
    const todos = melhoresMercadosPara(observations, produtoId, usuario);
    const LIMITE = 3;
    return {
      produtoId,
      totalMercados: todos.length,
      mercados: todos.slice(0, LIMITE).map((m) => ({
        mercadoId: m.mercadoId,
        mercadoNome: m.mercadoNome,
        endereco: m.endereco,
        lat: m.lat,
        lng: m.lng,
        priceCents: m.priceCents,
        distanciaMetros: m.distanciaMetros,
        atualizadoEm: m.observedAt.toISOString(),
      })),
    };
  }
}
