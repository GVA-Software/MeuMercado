import { z } from 'zod';
import { IdSchema, MoneySchema } from './common.js';

export const CartItemSchema = z.object({
  lineId: IdSchema,
  produtoId: IdSchema,
  nome: z.string().min(1).max(120),
  emoji: z.string().max(8).optional(),
  /** null = item PLANEJADO (ainda sem preço, na lista). */
  unitPrice: MoneySchema.nullable(),
  quantity: z.number().int().min(1),
  /** Já riscado/comprado (com preço)? */
  comprado: z.boolean(),
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

/** Adicionar um item à lista/carrinho. Sem `unitPriceCents` = item PLANEJADO. */
export const AddCartItemSchema = z.object({
  produtoId: IdSchema,
  nome: z.string().min(1).max(120),
  emoji: z.string().max(8).optional(),
  /** Opcional: informado só no "add rápido com preço"; na lista, o preço vem ao riscar. */
  unitPriceCents: z.number().int().positive().optional(),
  quantity: z.number().int().min(1).max(999).default(1),
});
export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;

/** Riscar um item: grava o preço pago e a quantidade (e alimenta a base). */
export const MarcarCompradoSchema = z.object({
  precoCents: z.number().int().positive().max(100_000_000),
  quantity: z.number().int().min(1).max(999).default(1),
});
export type MarcarCompradoInput = z.infer<typeof MarcarCompradoSchema>;

export const SetLimiteSchema = z.object({
  limiteCents: z.number().int().min(0).nullable(),
});
export type SetLimiteInput = z.infer<typeof SetLimiteSchema>;
