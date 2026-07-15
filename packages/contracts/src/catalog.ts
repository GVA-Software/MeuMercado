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
  'Legumes',
  'Doces',
  'Utilidades',
  'Outros',
]);
export type CategoriaDTO = z.infer<typeof CategoriaSchema>;

export const UnidadeSchema = z.enum(['un', 'kg', 'g', 'L', 'ml', 'duzia', 'pacote']);

/** Código de barras (EAN-8/EAN-13/UPC) — 8 a 14 dígitos. */
export const EanSchema = z.string().regex(/^\d{8,14}$/);

export const ProdutoSchema = z.object({
  id: IdSchema,
  nome: z.string().min(1).max(120),
  categoria: CategoriaSchema,
  unidade: UnidadeSchema,
  emoji: z.string().max(8).optional(),
  ean: EanSchema.optional(),
});
export type ProdutoDTO = z.infer<typeof ProdutoSchema>;

/**
 * Resposta da busca por código de barras. `produto` vem preenchido quando o EAN já
 * está no catálogo; senão `sugestaoNome` traz o nome do Open Food Facts (ainda não
 * é um produto — vira um ao confirmar). Ambos nulos = não encontrado em lugar nenhum.
 */
export const EanLookupSchema = z.object({
  ean: EanSchema,
  produto: ProdutoSchema.nullable(),
  sugestaoNome: z.string().nullable(),
});
export type EanLookupDTO = z.infer<typeof EanLookupSchema>;

/**
 * Entrada para cadastrar um produto que não existe no catálogo. Só o nome é
 * obrigatório — categoria/unidade têm default para não criar atrito no cadastro
 * rápido (o usuário pode refinar depois).
 */
export const CreateProdutoSchema = z.object({
  nome: z.string().min(1).max(120),
  categoria: CategoriaSchema.optional(),
  unidade: UnidadeSchema.optional(),
  emoji: z.string().max(8).optional(),
  ean: EanSchema.optional(),
});
export type CreateProdutoInput = z.infer<typeof CreateProdutoSchema>;
