import { z } from 'zod';
import { IdSchema } from './common.js';

/**
 * ATENÇÃO: manter esta lista em sincronia com `CATEGORIAS` em
 * `@meumercado/domain` (catalog/Categoria.ts). Um teste de contrato garante isso
 * quando o workspace estiver instalado.
 */
export const CategoriaSchema = z.enum([
  'Graos',
  'Oleos',
  'Basicos',
  'Bebidas',
  'Laticinios',
  'Padaria',
  'Massas',
  'Conservas',
  'Carnes',
  'Limpeza',
  'Higiene',
  'Frutas',
  'Verduras',
  'Outros',
]);
export type CategoriaDTO = z.infer<typeof CategoriaSchema>;

export const UnidadeSchema = z.enum(['un', 'kg', 'g', 'L', 'ml', 'duzia', 'pacote']);

export const ProdutoSchema = z.object({
  id: IdSchema,
  nome: z.string().min(1).max(120),
  categoria: CategoriaSchema,
  unidade: UnidadeSchema,
  emoji: z.string().max(8).optional(),
});
export type ProdutoDTO = z.infer<typeof ProdutoSchema>;

/** Entrada para cadastrar um produto que não existe no catálogo. */
export const CreateProdutoSchema = ProdutoSchema.omit({ id: true });
export type CreateProdutoInput = z.infer<typeof CreateProdutoSchema>;
