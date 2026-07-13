import { z } from 'zod';

/**
 * Importação de preços a partir do QR Code da NFC-e (cupom fiscal). O app lê o
 * QR (que é uma URL da SEFAZ), o servidor busca a página pública e extrai os
 * itens. Cada item vira uma observação de preço (fonte `qr`).
 */

/** Um item extraído do cupom (rascunho — o usuário revê antes de importar). */
export const NfceItemDraftSchema = z.object({
  descricao: z.string().min(1).max(200),
  /** Código do SKU no varejista — distingue produtos de mesma descrição (tamanhos). */
  codigo: z.string().max(40).optional(),
  quantidade: z.number().positive().optional(),
  unidade: z.string().max(12).optional(),
  /** Preço UNITÁRIO em centavos. */
  unitPriceCents: z.number().int().positive(),
});
export type NfceItemDraftDTO = z.infer<typeof NfceItemDraftSchema>;

/** Rascunho do cupom lido: mercado, data e itens. */
export const NfceDraftSchema = z.object({
  uf: z.string().length(2),
  /** Chave de acesso da NF-e (44 dígitos) — usada para não importar 2x a mesma nota. */
  chave: z.string().max(60).optional(),
  /** true se esta nota já foi importada antes (trava anti-duplicata). */
  jaImportada: z.boolean().optional(),
  /** Nome exibível — nome fantasia (via CNPJ) se encontrado, senão razão social. */
  mercadoNome: z.string().min(1).max(160),
  mercadoCnpj: z.string().max(20).optional(),
  mercadoEndereco: z.string().max(240).optional(),
  mercadoLat: z.number().min(-90).max(90).optional(),
  mercadoLng: z.number().min(-180).max(180).optional(),
  /** ISO da emissão (se conseguimos extrair). */
  dataEmissao: z.string().datetime().optional(),
  itens: z.array(NfceItemDraftSchema),
});
export type NfceDraftDTO = z.infer<typeof NfceDraftSchema>;

/** Pré-visualização: envia a URL lida do QR, recebe o rascunho. */
export const NfcePreviewRequestSchema = z.object({
  url: z.string().url().max(2000),
});
export type NfcePreviewRequest = z.infer<typeof NfcePreviewRequestSchema>;

/** Item confirmado pelo usuário para importar. */
export const NfceImportItemSchema = z.object({
  nome: z.string().min(1).max(200),
  codigo: z.string().max(40).optional(),
  quantidade: z.number().positive().max(9999).optional(),
  /** Unidade de venda lida do cupom (kg/un/…) — distingue itens por peso. */
  unidade: z.string().max(12).optional(),
  priceCents: z.number().int().positive().max(100_000_00),
});
export type NfceImportItem = z.infer<typeof NfceImportItemSchema>;

/** Importação confirmada: cria produtos (se novos) + observações de preço. */
export const NfceImportRequestSchema = z.object({
  mercadoNome: z.string().min(1).max(160),
  chave: z.string().max(60).optional(),
  mercadoId: z.string().max(120).optional(),
  mercadoEndereco: z.string().max(240).optional(),
  mercadoLat: z.number().min(-90).max(90).optional(),
  mercadoLng: z.number().min(-180).max(180).optional(),
  dataEmissao: z.string().datetime().optional(),
  itens: z.array(NfceImportItemSchema).min(1).max(200),
});
export type NfceImportRequest = z.infer<typeof NfceImportRequestSchema>;

export const NfceImportResultSchema = z.object({
  importados: z.number().int().nonnegative(),
  produtosCriados: z.number().int().nonnegative(),
});
export type NfceImportResult = z.infer<typeof NfceImportResultSchema>;
