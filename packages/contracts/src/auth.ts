import { z } from 'zod';
import { IdSchema } from './common.js';

/**
 * Versão vigente da Política de Privacidade / Termos de Uso. Gravada no cadastro
 * (trilha de consentimento LGPD). Ao publicar uma versão nova, atualize aqui E nas
 * páginas /privacidade.html e /termos.html.
 */
export const POLITICA_VERSAO = '2026-07-16';

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  nome: z.string().min(1).max(120),
  senha: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(200),
  /** Consentimento explícito com a Política de Privacidade e os Termos (LGPD). */
  aceitouTermos: z.literal(true, {
    errorMap: () => ({ message: 'É preciso aceitar a Política de Privacidade e os Termos.' }),
  }),
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

/** Pedido de recuperação de senha (manda o link por e-mail). */
export const EsqueciSenhaSchema = z.object({
  email: z.string().email().max(254),
});
export type EsqueciSenhaInput = z.infer<typeof EsqueciSenhaSchema>;

/** Redefinição de senha a partir do token do e-mail. */
export const RedefinirSenhaSchema = z.object({
  token: z.string().min(10).max(200),
  senha: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(200),
});
export type RedefinirSenhaInput = z.infer<typeof RedefinirSenhaSchema>;

/** Excluir a própria conta — exige a senha atual como confirmação. */
export const ExcluirContaSchema = z.object({
  senha: z.string().min(1, 'Informe sua senha').max(200),
});
export type ExcluirContaInput = z.infer<typeof ExcluirContaSchema>;

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
