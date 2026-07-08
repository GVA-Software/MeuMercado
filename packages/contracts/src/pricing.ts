import { z } from 'zod';
import { IdSchema } from './common.js';

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
