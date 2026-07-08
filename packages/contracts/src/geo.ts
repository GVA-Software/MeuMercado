import { z } from 'zod';
import { GeoPointSchema } from './common.js';

// ---- Geocoding (busca de endereços — Photon/Nominatim) ----
export const GeocodeQuerySchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  /** Viés opcional por proximidade. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
export type GeocodeQuery = z.infer<typeof GeocodeQuerySchema>;

export const GeocodeResultSchema = z.object({
  nome: z.string(),
  endereco: z.string().optional(),
  tipo: z.string().optional(),
  localizacao: GeoPointSchema,
});
export type GeocodeResultDTO = z.infer<typeof GeocodeResultSchema>;

// ---- Roteamento ("como chegar" ao mercado — Valhalla) ----
export const ManeuverSchema = z.enum([
  'depart',
  'turn-left',
  'turn-right',
  'turn-slight-left',
  'turn-slight-right',
  'turn-sharp-left',
  'turn-sharp-right',
  'continue',
  'roundabout',
  'merge',
  'fork',
  'arrive',
]);

export const RouteRequestSchema = z.object({
  from: GeoPointSchema,
  to: GeoPointSchema,
  modo: z.enum(['auto', 'pedestrian', 'bicycle']).default('auto'),
});
export type RouteRequest = z.infer<typeof RouteRequestSchema>;

export const RouteStepSchema = z.object({
  instruction: z.string(),
  maneuver: ManeuverSchema,
  location: GeoPointSchema,
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
});

export const RouteResponseSchema = z.object({
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  geometry: z.array(GeoPointSchema).min(2),
  steps: z.array(RouteStepSchema),
});
export type RouteResponse = z.infer<typeof RouteResponseSchema>;
