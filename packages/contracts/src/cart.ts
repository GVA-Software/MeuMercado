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

/** Mercado da compra (confirmado pela localização) — os preços digitados no
 * carrinho são atribuídos a ele na base colaborativa. */
export const CartMercadoSchema = z.object({
  id: z.string().min(1).max(120),
  nome: z.string().min(1).max(160),
  endereco: z.string().max(240).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type CartMercadoDTO = z.infer<typeof CartMercadoSchema>;

export const CartSchema = z.object({
  id: IdSchema,
  items: z.array(CartItemSchema),
  total: MoneySchema,
  limite: MoneySchema.nullable(),
  remaining: MoneySchema.nullable(),
  progressPercent: z.number().nullable(),
  status: BudgetStatusSchema,
  mercado: CartMercadoSchema.nullable(),
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
