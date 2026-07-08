import { z } from 'zod';
import { IdSchema } from './common.js';

export const PlanoSchema = z.enum(['free', 'pro']);
export const PeriodoSchema = z.enum(['mensal', 'anual']);
export const StatusAssinaturaSchema = z.enum(['trial', 'ativa', 'cancelada', 'expirada']);

export type Plano = z.infer<typeof PlanoSchema>;
export type Periodo = z.infer<typeof PeriodoSchema>;
export type StatusAssinatura = z.infer<typeof StatusAssinaturaSchema>;

export const SubscriptionSchema = z.object({
  usuarioId: IdSchema,
  plano: PlanoSchema,
  periodo: PeriodoSchema.nullable(),
  status: StatusAssinaturaSchema,
  /** Derivado no servidor: reflete se o Pro está vigente agora. */
  isPro: z.boolean(),
  diasRestantes: z.number().int().nonnegative(),
  trialFim: z.string().datetime().nullable(),
  periodoFim: z.string().datetime().nullable(),
});
export type SubscriptionDTO = z.infer<typeof SubscriptionSchema>;

/** Assinar o Pro (após confirmação de pagamento, na prática via webhook do gateway). */
export const SubscribeSchema = z.object({ periodo: PeriodoSchema });
export type SubscribeInput = z.infer<typeof SubscribeSchema>;

/** Preços dos planos (exibição). */
export const PLANOS = {
  mensal: { precoCents: 990, label: 'R$ 9,90/mês' },
  anual: { precoCents: 7990, label: 'R$ 79,90/ano' },
} as const;
