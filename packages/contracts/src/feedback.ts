import { z } from 'zod';
import { IdSchema } from './common.js';

export const FeedbackTipoSchema = z.enum(['bug', 'sugestao', 'elogio', 'outro']);
export type FeedbackTipo = z.infer<typeof FeedbackTipoSchema>;

export const FeedbackStatusSchema = z.enum(['aberto', 'respondido']);

/** Envio de feedback pelo usuário. */
export const CreateFeedbackSchema = z.object({
  tipo: FeedbackTipoSchema,
  mensagem: z.string().min(3, 'Escreva um pouco mais').max(2000),
});
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;

/** Um feedback (visão do ADM). */
export const FeedbackSchema = z.object({
  id: IdSchema,
  usuarioId: IdSchema,
  usuarioNome: z.string(),
  usuarioEmail: z.string(),
  tipo: FeedbackTipoSchema,
  mensagem: z.string(),
  status: FeedbackStatusSchema,
  resposta: z.string().nullable(),
  criadoEm: z.string().datetime(),
  respondidoEm: z.string().datetime().nullable(),
});
export type FeedbackDTO = z.infer<typeof FeedbackSchema>;

export const FeedbacksResponseSchema = z.object({
  feedbacks: z.array(FeedbackSchema),
  /** Abertos (não respondidos) — alimenta o sininho. */
  abertos: z.number().int().nonnegative(),
});
export type FeedbacksResponse = z.infer<typeof FeedbacksResponseSchema>;

/** Resposta do ADM a um feedback. */
export const ResponderFeedbackSchema = z.object({
  resposta: z.string().min(1).max(2000),
});
export type ResponderFeedbackInput = z.infer<typeof ResponderFeedbackSchema>;
