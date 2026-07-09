import { z } from 'zod';
import { IdSchema } from './common.js';

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  nome: z.string().min(1).max(120),
  senha: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(200),
  /** Token do Cloudflare Turnstile (validado no servidor). */
  turnstileToken: z.string().optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1).max(200),
  turnstileToken: z.string().optional(),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  nome: z.string(),
  /** Derivado no servidor (allowlist de e-mails). Libera o painel de administração. */
  isAdmin: z.boolean(),
});
export type UserDTO = z.infer<typeof UserSchema>;

/** Atualização do próprio perfil (só o nome; e-mail não muda). */
export const UpdateNameSchema = z.object({
  nome: z.string().min(1, 'Informe seu nome').max(120),
});
export type UpdateNameInput = z.infer<typeof UpdateNameSchema>;

/** Access token vai no corpo; o refresh vai em cookie httpOnly (não exposto ao JS). */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
