import { z } from 'zod';

/**
 * Contratos de dados (wire) compartilhados entre API e PWA. Validados com zod:
 * a MESMA definição valida o corpo das requisições no NestJS e as respostas no
 * front — fonte única de verdade, sem tipos duplicados que divergem.
 */

export const CurrencySchema = z.literal('BRL');

/** Dinheiro trafega em centavos inteiros (nunca float). Espelha o VO Money. */
export const MoneySchema = z.object({
  cents: z.number().int(),
  currency: CurrencySchema,
});
export type MoneyDTO = z.infer<typeof MoneySchema>;

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPointDTO = z.infer<typeof GeoPointSchema>;

export const IdSchema = z.string().min(1).max(128);

/** Envelope de paginação padrão para listagens. */
export const PageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    limit: z.number().int(),
    offset: z.number().int(),
  });
}
