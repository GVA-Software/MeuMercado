import { z } from 'zod';

/** Relatório do QA de conversação da Nina (rodado sobre o catálogo vivo). */
export const QaAchadoSchema = z.object({
  produtoId: z.string(),
  produtoNome: z.string(),
  lente: z.enum(['busca', 'fluxo', 'cobertura', 'copy', 'edge']),
  severidade: z.enum(['erro', 'aviso']),
  problema: z.string(),
});
export type QaAchadoDTO = z.infer<typeof QaAchadoSchema>;

export const QaLenteResumoSchema = z.object({
  lente: z.string(),
  ok: z.number().int().nonnegative(),
  problemas: z.number().int().nonnegative(),
});

export const QaConversaReportSchema = z.object({
  totalProdutos: z.number().int().nonnegative(),
  comPreco: z.number().int().nonnegative(),
  semPreco: z.number().int().nonnegative(),
  erros: z.number().int().nonnegative(),
  avisos: z.number().int().nonnegative(),
  porLente: z.array(QaLenteResumoSchema),
  achados: z.array(QaAchadoSchema),
  geradoEm: z.string().datetime(),
});
export type QaConversaReportDTO = z.infer<typeof QaConversaReportSchema>;
