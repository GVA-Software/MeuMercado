/**
 * Categorias de produto (fixas). Manter como união literal + lista dá segurança
 * de tipo e permite validar entrada sem depender de enum em runtime.
 */
export const CATEGORIAS = [
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
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export function isCategoria(value: string): value is Categoria {
  return (CATEGORIAS as readonly string[]).includes(value);
}
