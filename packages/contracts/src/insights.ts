import { z } from 'zod';
import { IdSchema, MoneySchema } from './common.js';

export const InsightTypeSchema = z.enum([
  'tendencia-alta',
  'tendencia-baixa',
  'mais-barato-em',
  'menor-preco-historico',
  'cesta-otima',
  'destaque',
  'resumo',
]);
export type InsightTypeDTO = z.infer<typeof InsightTypeSchema>;

/** Insight da Nina (calculado por estatística no servidor). */
export const InsightSchema = z.object({
  type: InsightTypeSchema,
  urgente: z.boolean(),
  titulo: z.string(),
  sub: z.string(),
  emoji: z.string().max(8),
  produtoId: IdSchema.optional(),
  mercadoId: IdSchema.optional(),
  economia: MoneySchema.optional(),
});
export type InsightDTO = z.infer<typeof InsightSchema>;

export const InsightsResponseSchema = z.object({
  insights: z.array(InsightSchema),
  geradoEm: z.string().datetime(),
});
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;
