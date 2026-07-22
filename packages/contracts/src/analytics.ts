import { z } from 'zod';

/**
 * Analytics própria (self-hosted). Whitelist de eventos: o cliente só consegue
 * registrar eventos conhecidos — evita poluir/abusar da tabela.
 */
export const EVENT_NAMES = [
  'onboarding_visto',
  'onboarding_cta_registrar',
  'onboarding_explorar',
  'onboarding_dispensado',
  /** A Nina não entendeu / não achou — alimenta o loop de aprendizado (prop `q`). */
  'nina_sem_resposta',
  /** Abriu o app (logado). prop `plataforma`: 'web' | 'pwa' (instalado na tela inicial). */
  'app_aberto',
  /** Fim de um trecho de sessão em foco. prop `durMs` (duração) + `plataforma`. */
  'sessao_fim',
] as const;

export const EventNameSchema = z.enum(EVENT_NAMES);
export type EventName = z.infer<typeof EventNameSchema>;

/** Corpo de POST /events — o servidor carimba usuário e timestamp. */
export const TrackEventSchema = z.object({
  name: EventNameSchema,
  props: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type TrackEventInput = z.infer<typeof TrackEventSchema>;

/** Funil de ativação (visão do admin): do cadastro ao 1º preço registrado. */
export const AdminFunnelSchema = z.object({
  totalUsuarios: z.number().int().nonnegative(),
  onboardingVistos: z.number().int().nonnegative(),
  clicaramRegistrar: z.number().int().nonnegative(),
  explorar: z.number().int().nonnegative(),
  dispensaram: z.number().int().nonnegative(),
  /** Usuários distintos que registraram ao menos 1 preço (reporter_id, sem seed). */
  registraramPreco: z.number().int().nonnegative(),
  /** Coorte: dos que viram o onboarding, quantos registraram preço. */
  vistosQueRegistraram: z.number().int().nonnegative(),
  eventos: z.array(
    z.object({
      name: z.string(),
      usuarios: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  ),
});
export type AdminFunnelDTO = z.infer<typeof AdminFunnelSchema>;
