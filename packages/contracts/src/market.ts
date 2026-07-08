import { z } from 'zod';
import { GeoPointSchema, IdSchema } from './common.js';

export const MercadoSchema = z.object({
  id: IdSchema,
  nome: z.string().min(1).max(120),
  rede: z.string().max(80).optional(),
  endereco: z.string().max(240).optional(),
  localizacao: GeoPointSchema,
  /** Preenchido quando a busca é relativa a uma posição do usuário. */
  distanciaMetros: z.number().nonnegative().optional(),
});
export type MercadoDTO = z.infer<typeof MercadoSchema>;

/** Busca de mercados próximos a um ponto (aba Mapa). */
export const NearbyMarketsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  raioMetros: z.coerce.number().int().min(100).max(50_000).default(5_000),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type NearbyMarketsQuery = z.infer<typeof NearbyMarketsQuerySchema>;
