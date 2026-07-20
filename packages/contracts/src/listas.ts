import { z } from 'zod';
import { IdSchema } from './common.js';

/** Limites de anti-abuso das listas salvas (também aplicados no service). */
export const LISTA_MAX_ITENS = 100;
export const LISTA_MAX_POR_USUARIO = 30;

/** Um item da lista salva — snapshot (não referência viva ao catálogo). */
export const SavedListItemSchema = z.object({
  produtoId: IdSchema,
  nome: z.string().min(1).max(120),
  emoji: z.string().max(8).optional(),
  quantity: z.number().int().min(1).max(999),
});
export type SavedListItemDTO = z.infer<typeof SavedListItemSchema>;

/** Lista de compras salva (modelo reutilizável do usuário). */
export const SavedListSchema = z.object({
  id: IdSchema,
  nome: z.string().min(1).max(60),
  itens: z.array(SavedListItemSchema),
  criadaEm: z.string().datetime(),
});
export type SavedListDTO = z.infer<typeof SavedListSchema>;

/** Salvar a lista atual como modelo nomeado. */
export const SaveListSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  itens: z.array(SavedListItemSchema).min(1).max(LISTA_MAX_ITENS),
});
export type SaveListInput = z.infer<typeof SaveListSchema>;

export const SavedListsResponseSchema = z.object({
  listas: z.array(SavedListSchema),
});
export type SavedListsResponse = z.infer<typeof SavedListsResponseSchema>;
