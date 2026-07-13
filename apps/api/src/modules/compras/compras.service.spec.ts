import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { CompraDTO, PriceSummaryDTO } from '@meumercado/contracts';
import type { CompraRepository } from './compra.repository.js';
import type { PricingService } from '../pricing/pricing.service.js';
import { ComprasService } from './compras.service.js';

function make(mediaCents: number | null) {
  let salvo: CompraDTO | null = null;
  const repo: CompraRepository = {
    salvar: (_u, c) => {
      salvo = c;
      return Promise.resolve();
    },
    listarPorUsuario: () => Promise.resolve([]),
    excluir: () => Promise.resolve(),
    excluirTodas: () => Promise.resolve(),
  };
  const resumo: PriceSummaryDTO = {
    produtoId: 'p',
    mediaCents,
    minCents: null,
    maxCents: null,
    trend: null,
    trendPct: null,
    amostras: 0,
  };
  const pricing = { resumo: () => Promise.resolve(resumo) } as unknown as PricingService;
  return { service: new ComprasService(repo, pricing), getSalvo: () => salvo };
}

describe('ComprasService — quantidade fracionária (item por peso)', () => {
  it('total arredonda unitPrice × quantidade fracionária (0,348 kg)', async () => {
    const { service } = make(null);
    const compra = await service.registrar('u1', {
      itens: [
        { produtoId: 'p', nome: 'CARNE', unitPriceCents: 3000, quantity: 0.348, unidade: 'kg' },
      ],
    });
    // Antes o round(0,348)=0→1 dava R$30,00; agora é round(3000 × 0,348) = R$10,44.
    expect(compra.totalCents).toBe(1044);
  });

  it('economia usa a quantidade real, não arredondada para 1', async () => {
    const { service } = make(4000); // média 40,00/kg; pagou 30,00/kg em 0,5 kg
    const compra = await service.registrar('u1', {
      itens: [
        { produtoId: 'p', nome: 'CARNE', unitPriceCents: 3000, quantity: 0.5, unidade: 'kg' },
      ],
    });
    expect(compra.economiaCents).toBe(500); // round((4000-3000) × 0,5)
  });
});
