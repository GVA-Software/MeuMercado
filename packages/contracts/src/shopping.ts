import { z } from 'zod';
import { IdSchema } from './common.js';

/** "Onde eu compro este produto?" — produto + localização opcional do usuário. */
export const OndeComprarSchema = z.object({
  produtoId: IdSchema,
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type OndeComprarInput = z.infer<typeof OndeComprarSchema>;

/** Um mercado ranqueado (preço + distância) para comprar o produto. */
export const MercadoRankeadoSchema = z.object({
  mercadoId: z.string(),
  mercadoNome: z.string(),
  endereco: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  priceCents: z.number().int().nonnegative(),
  distanciaMetros: z.number().int().nonnegative().nullable(),
  atualizadoEm: z.string().datetime(),
});
export type MercadoRankeadoDTO = z.infer<typeof MercadoRankeadoSchema>;

export const OndeComprarResponseSchema = z.object({
  produtoId: IdSchema,
  /** Os melhores (top N) mercados com preço para o produto. */
  mercados: z.array(MercadoRankeadoSchema),
  /** Total de mercados com preço (para a mensagem de cobertura). */
  totalMercados: z.number().int().nonnegative(),
});
export type OndeComprarResponse = z.infer<typeof OndeComprarResponseSchema>;

/** Um mercado avaliado para uma CATEGORIA (conjunto de produtos). */
export const MercadoAgregadoSchema = z.object({
  mercadoId: z.string(),
  mercadoNome: z.string(),
  endereco: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  distanciaMetros: z.number().int().nonnegative().nullable(),
  produtosComPreco: z.number().int().nonnegative(),
  vitorias: z.number().int().nonnegative(),
});
export type MercadoAgregadoDTO = z.infer<typeof MercadoAgregadoSchema>;

/** "Qual o melhor mercado para [categoria]?" — mercados ranqueados + o termo. */
export const MelhorMercadoResponseSchema = z.object({
  termo: z.string(),
  /** Nº de produtos (com preço) que casaram com o termo. */
  totalProdutos: z.number().int().nonnegative(),
  mercados: z.array(MercadoAgregadoSchema),
});
export type MelhorMercadoResponse = z.infer<typeof MelhorMercadoResponseSchema>;
