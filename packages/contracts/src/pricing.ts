import { z } from 'zod';
import { IdSchema } from './common.js';
import { ProdutoSchema } from './catalog.js';

export const PriceSourceSchema = z.enum(['manual', 'qr', 'foto']);
export type PriceSourceDTO = z.infer<typeof PriceSourceSchema>;

export const TrendSchema = z.enum(['subiu', 'caiu', 'estavel']);
export type TrendDTO = z.infer<typeof TrendSchema>;

/**
 * Envio colaborativo de preço. É a entrada de dados mais sensível do app
 * (anti-fraude): valores limitados, data não pode ser no futuro. O servidor
 * ainda aplica reputação/limites por usuário.
 */
export const ReportPriceSchema = z.object({
  produtoId: IdSchema,
  mercadoId: IdSchema,
  /** Nome do mercado (denormalizado) — permite exibir/atribuir mercados reais do
   * OSM, cujos ids não estão no seed. */
  mercadoNome: z.string().min(1).max(120),
  /** Endereço + coordenadas do mercado (denormalizados) — exibição e "ver no mapa". */
  mercadoEndereco: z.string().max(240).optional(),
  mercadoLat: z.number().min(-90).max(90).optional(),
  mercadoLng: z.number().min(-180).max(180).optional(),
  priceCents: z.number().int().positive().max(100_000_00, 'Preço acima do limite plausível'),
  source: PriceSourceSchema,
  observedAt: z
    .string()
    .datetime()
    .optional()
    .refine((v) => v === undefined || new Date(v).getTime() <= Date.now(), {
      message: 'Data de observação não pode ser no futuro',
    }),
});
export type ReportPriceInput = z.infer<typeof ReportPriceSchema>;

/** Resumo estatístico de um produto (tabela de preços / média regional). */
export const PriceSummarySchema = z.object({
  produtoId: IdSchema,
  mediaCents: z.number().int().nonnegative().nullable(),
  minCents: z.number().int().nonnegative().nullable(),
  maxCents: z.number().int().nonnegative().nullable(),
  trend: TrendSchema.nullable(),
  trendPct: z.number().nullable(),
  amostras: z.number().int().nonnegative(),
});
export type PriceSummaryDTO = z.infer<typeof PriceSummarySchema>;

/** Uma linha da tabela de preços colaborativa (produto + estatística regional). */
export const PriceTableRowSchema = z.object({
  produto: ProdutoSchema,
  mediaCents: z.number().int().nonnegative().nullable(),
  minCents: z.number().int().nonnegative().nullable(),
  maxCents: z.number().int().nonnegative().nullable(),
  trend: TrendSchema.nullable(),
  trendPct: z.number().nullable(),
  amostras: z.number().int().nonnegative(),
  /** Nome do mercado onde está mais barato (menor observação). */
  menorPrecoMercado: z.string().nullable(),
  /** ISO da observação mais recente. */
  atualizadoEm: z.string().datetime().nullable(),
});
export type PriceTableRowDTO = z.infer<typeof PriceTableRowSchema>;

/** Um ponto da série histórica de preços de um produto. */
export const PriceHistoryPointSchema = z.object({
  observedAt: z.string().datetime(),
  priceCents: z.number().int().positive(),
  mercadoId: z.string(),
  mercadoNome: z.string().nullable(),
  mercadoEndereco: z.string().nullable(),
  mercadoLat: z.number().nullable(),
  mercadoLng: z.number().nullable(),
  source: PriceSourceSchema,
});
export type PriceHistoryPointDTO = z.infer<typeof PriceHistoryPointSchema>;

export const PriceHistorySchema = z.object({
  produtoId: IdSchema,
  pontos: z.array(PriceHistoryPointSchema),
});
export type PriceHistoryDTO = z.infer<typeof PriceHistorySchema>;

/** Um mercado presente na base (para o filtro da tabela de preços). */
export const MercadoResumoSchema = z.object({
  nome: z.string(),
  count: z.number().int().nonnegative(),
});
export type MercadoResumoDTO = z.infer<typeof MercadoResumoSchema>;

/**
 * Estimativa da lista: dado os itens (produto + quantidade) que o usuário está
 * planejando, devolve uma prévia do gasto usando a MÉDIA da base colaborativa,
 * e diz quais produtos ainda não têm preço (cobertura). Ajuda a planejar antes
 * de ir ao mercado. Autenticado, mas NÃO é recurso Pro.
 */
export const EstimativaListaSchema = z.object({
  itens: z
    .array(
      z.object({
        produtoId: IdSchema,
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(200),
});
export type EstimativaListaInput = z.infer<typeof EstimativaListaSchema>;

export const EstimativaItemSchema = z.object({
  produtoId: IdSchema,
  /** Média da base (em centavos) ou null se ainda não há preço deste produto. */
  mediaCents: z.number().int().nonnegative().nullable(),
});
export type EstimativaItemDTO = z.infer<typeof EstimativaItemSchema>;

/** A lista inteira precificada NUM mercado (para "onde sai mais barato"). */
export const EstimativaMercadoSchema = z.object({
  mercadoId: z.string(),
  mercadoNome: z.string(),
  /** Total da lista neste mercado: soma do preço MAIS RECENTE × qtd, só dos itens que ele tem. */
  totalCents: z.number().int().nonnegative(),
  /** Quantos itens da lista este mercado tem preço (transparência da cobertura). */
  itensCobertos: z.number().int().nonnegative(),
  /** Quanto essa cesta (mesmos itens) sai mais barata que a MÉDIA da base. Sempre ≥ 0. */
  economiaVsMediaCents: z.number().int().nonnegative(),
});
export type EstimativaMercadoDTO = z.infer<typeof EstimativaMercadoSchema>;

export const EstimativaListaResponseSchema = z.object({
  itens: z.array(EstimativaItemSchema),
  /** Soma de média × quantidade, só dos itens que TÊM preço na base. */
  totalEstimadoCents: z.number().int().nonnegative(),
  /** IDs dos produtos sem preço na base (o front mostra os nomes). */
  semPreco: z.array(IdSchema),
  /** Nº de itens da lista (para "cobre k de N"). */
  totalItens: z.number().int().nonnegative(),
  /** Ranking: onde a lista sai mais barata (mais completos e baratos primeiro). */
  mercados: z.array(EstimativaMercadoSchema),
});
export type EstimativaListaResponse = z.infer<typeof EstimativaListaResponseSchema>;

/**
 * Produto que a comunidade só tem preço em UM mercado — ainda não dá pra
 * comparar. É o alvo do mutirão "complete a comparação": um 2º mercado já
 * habilita a Nina a dizer onde compensa. Aprofunda a base (cobertura).
 */
export const ProdutoParaCompletarSchema = z.object({
  produto: ProdutoSchema,
  /** Preço atual conhecido (média das observações do único mercado). */
  precoCents: z.number().int().nonnegative(),
  /** Nome do único mercado com preço deste produto. */
  mercadoNome: z.string().nullable(),
  atualizadoEm: z.string().datetime().nullable(),
});
export type ProdutoParaCompletarDTO = z.infer<typeof ProdutoParaCompletarSchema>;
