import { z } from 'zod';
import { IdSchema, MoneySchema } from './common.js';

export const CartItemSchema = z.object({
  lineId: IdSchema,
  produtoId: IdSchema,
  nome: z.string().min(1).max(120),
  emoji: z.string().max(8).optional(),
  unitPrice: MoneySchema,
  quantity: z.number().int().min(1),
  subtotal: MoneySchema,
});
export type CartItemDTO = z.infer<typeof CartItemSchema>;

export const BudgetStatusSchema = z.enum(['sem-limite', 'ok', 'alerta', 'estourado']);

export const CartSchema = z.object({
  id: IdSchema,
  items: z.array(CartItemSchema),
  total: MoneySchema,
  limite: MoneySchema.nullable(),
  remaining: MoneySchema.nullable(),
  progressPercent: z.number().nullable(),
  status: BudgetStatusSchema,
});
export type CartDTO = z.infer<typeof CartSchema>;

/** Adicionar um item ao carrinho. */
export const AddCartItemSchema = z.object({
  produtoId: IdSchema,
  nome: z.string().min(1).max(120),
  emoji: z.string().max(8).optional(),
  unitPriceCents: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999).default(1),
});
export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;

export const SetLimiteSchema = z.object({
  limiteCents: z.number().int().min(0).nullable(),
});
export type SetLimiteInput = z.infer<typeof SetLimiteSchema>;
