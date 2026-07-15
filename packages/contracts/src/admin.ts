import { z } from 'zod';
import { IdSchema } from './common.js';
import { CategoriaSchema } from './catalog.js';
import { PeriodoSchema, PlanoSchema, StatusAssinaturaSchema } from './billing.js';

/** Um usuário na visão do administrador (perfil + situação da assinatura). */
export const AdminUserSchema = z.object({
  id: IdSchema,
  nome: z.string(),
  email: z.string().email(),
  criadoEm: z.string().datetime(),
  isAdmin: z.boolean(),
  plano: PlanoSchema,
  periodo: PeriodoSchema.nullable(),
  status: StatusAssinaturaSchema,
  isPro: z.boolean(),
  diasRestantes: z.number().int().nonnegative(),
  trialFim: z.string().datetime().nullable(),
  periodoFim: z.string().datetime().nullable(),
});
export type AdminUserDTO = z.infer<typeof AdminUserSchema>;

export const AdminUsersResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(AdminUserSchema),
});
export type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;

/** Painel: números gerais de cadastros e assinaturas. */
export const AdminStatsSchema = z.object({
  totalUsuarios: z.number().int().nonnegative(),
  admins: z.number().int().nonnegative(),
  proAtivos: z.number().int().nonnegative(),
  trials: z.number().int().nonnegative(),
  free: z.number().int().nonnegative(),
  cadastrosHoje: z.number().int().nonnegative(),
  cadastros7d: z.number().int().nonnegative(),
  cadastros30d: z.number().int().nonnegative(),
});
export type AdminStatsDTO = z.infer<typeof AdminStatsSchema>;

/** Conceder Pro a um usuário (por período). */
export const AdminGrantProSchema = z.object({ periodo: PeriodoSchema });
export type AdminGrantProInput = z.infer<typeof AdminGrantProSchema>;

/** Varredura de duplicados: produtos com nomes diferentes mas a mesma "chave". */
export const AdminDuplicadoProdutoSchema = z.object({
  id: IdSchema,
  nome: z.string(),
  precos: z.number().int().nonnegative(),
  mercados: z.number().int().nonnegative(),
});
export const AdminDuplicadosSchema = z.object({
  grupos: z.array(
    z.object({
      chave: z.string(),
      produtos: z.array(AdminDuplicadoProdutoSchema),
    }),
  ),
});
export type AdminDuplicadosDTO = z.infer<typeof AdminDuplicadosSchema>;

/** Juntar um grupo: mantém `manterId`, move os preços de `removerIds` e os remove. */
export const AdminJuntarSchema = z.object({
  manterId: IdSchema,
  removerIds: z.array(IdSchema).min(1).max(20),
});
export type AdminJuntarInput = z.infer<typeof AdminJuntarSchema>;

/** Painel de COBERTURA: catálogo, mercados e quem mais cadastra preços. */
export const AdminCoberturaProdutoSchema = z.object({
  id: IdSchema,
  nome: z.string(),
  categoria: z.string(),
  /** Mercados distintos com preço deste produto (2+ = dá pra comparar). */
  mercados: z.number().int().nonnegative(),
  /** Nomes dos mercados onde o produto tem preço (viram tags na UI). */
  mercadosNomes: z.array(z.string()),
  precos: z.number().int().nonnegative(),
  ultimoEm: z.string().datetime().nullable(),
});

export const AdminCoberturaMercadoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  endereco: z.string().nullable(),
  produtos: z.number().int().nonnegative(),
  precos: z.number().int().nonnegative(),
  ultimoEm: z.string().datetime().nullable(),
});

/** Ranking de quem mais cadastra preço (exclui a base de seed). */
export const AdminContribuidorSchema = z.object({
  userId: z.string(),
  nome: z.string(),
  email: z.string(),
  cadastros: z.number().int().nonnegative(),
});

export const AdminCoberturaSchema = z.object({
  totais: z.object({
    produtosCatalogo: z.number().int().nonnegative(),
    produtosComPreco: z.number().int().nonnegative(),
    produtosMultiMercado: z.number().int().nonnegative(),
    mercados: z.number().int().nonnegative(),
    precos: z.number().int().nonnegative(),
    contribuidores: z.number().int().nonnegative(),
  }),
  produtos: z.array(AdminCoberturaProdutoSchema),
  mercados: z.array(AdminCoberturaMercadoSchema),
  topUsuarios: z.array(AdminContribuidorSchema),
});
export type AdminCoberturaDTO = z.infer<typeof AdminCoberturaSchema>;

/** Exclusão de produtos em lote (some do catálogo e dos apps; apaga os preços). */
export const AdminExcluirProdutosSchema = z.object({
  ids: z.array(IdSchema).min(1).max(200),
});
export type AdminExcluirProdutosInput = z.infer<typeof AdminExcluirProdutosSchema>;

/**
 * Juntar mercados: unifica o mesmo mercado cadastrado sob nomes/ids diferentes
 * (ex.: "Carrefour" manual vs "CARREFOUR ... LTDA" da NFC-e). Os preços dos
 * `removerIds` passam a apontar pro `manterId` (com o nome/endereço dele).
 * Os ids de mercado não são UUID (podem vir de CNPJ), por isso `z.string()`.
 */
export const AdminJuntarMercadosSchema = z.object({
  manterId: z.string().min(1),
  removerIds: z.array(z.string().min(1)).min(1).max(50),
});
export type AdminJuntarMercadosInput = z.infer<typeof AdminJuntarMercadosSchema>;

/** Excluir mercados: apaga TODOS os preços dos mercados (some da comparação nos apps). */
export const AdminExcluirMercadosSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
});
export type AdminExcluirMercadosInput = z.infer<typeof AdminExcluirMercadosSchema>;

/** Um reporte de preço na edição do ADM (para corrigir valor errado / excluir). */
export const AdminPrecoSchema = z.object({
  id: z.string(),
  mercadoNome: z.string(),
  endereco: z.string().nullable(),
  precoCents: z.number().int().nonnegative(),
  observedAt: z.string().datetime(),
  source: z.string(),
});
export type AdminPrecoDTO = z.infer<typeof AdminPrecoSchema>;

/** Payload de edição de um produto: dados + seus reportes de preço. */
export const AdminProdutoEdicaoSchema = z.object({
  id: IdSchema,
  nome: z.string(),
  categoria: z.string(),
  unidade: z.string(),
  precos: z.array(AdminPrecoSchema),
});
export type AdminProdutoEdicaoDTO = z.infer<typeof AdminProdutoEdicaoSchema>;

/** Editar nome/categoria de um produto (ex.: corrigir gramatura após um merge). */
export const AdminEditarProdutoSchema = z.object({
  nome: z.string().min(1).max(120),
  categoria: CategoriaSchema,
});
export type AdminEditarProdutoInput = z.infer<typeof AdminEditarProdutoSchema>;

/** Corrigir o valor de UM reporte de preço (ex.: marcou a caixa em vez da unidade). */
export const AdminEditarPrecoSchema = z.object({
  precoCents: z.number().int().positive().max(100_000_000),
});
export type AdminEditarPrecoInput = z.infer<typeof AdminEditarPrecoSchema>;
