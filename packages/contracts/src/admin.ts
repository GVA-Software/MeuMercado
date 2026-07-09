import { z } from 'zod';
import { IdSchema } from './common.js';
import { PeriodoSchema, PlanoSchema, StatusAssinaturaSchema } from './billing.js';

/** Um usuário na visão do administrador (perfil + situação da assinatura). */
export const AdminUserSchema = z.object({
  id: IdSchema,
  nome: z.string(),
  email: z.string().email(),
  criadoEm: z.string().datetime(),
  isAdmin: z.boolean(),
  plano: PlanoSchema,
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
