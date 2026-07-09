import { z } from 'zod';

/** Uma compra finalizada (snapshot imutável do carrinho no momento do fechamento). */
export const CompraItemSchema = z.object({
  produtoId: z.string(),
  nome: z.string(),
  emoji: z.string().max(8).optional(),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});
export type CompraItemDTO = z.infer<typeof CompraItemSchema>;

export const CompraSchema = z.object({
  id: z.string(),
  mercadoNome: z.string().nullable(),
  mercadoId: z.string().nullable(),
  mercadoEndereco: z.string().nullable(),
  totalCents: z.number().int().nonnegative(),
  /** Quanto abaixo da média (base colaborativa) você pagou — economia estimada. */
  economiaCents: z.number().int().nonnegative(),
  itens: z.array(CompraItemSchema),
  criadaEm: z.string().datetime(),
});
export type CompraDTO = z.infer<typeof CompraSchema>;

export const ComprasResponseSchema = z.object({
  compras: z.array(CompraSchema),
});
export type ComprasResponse = z.infer<typeof ComprasResponseSchema>;
