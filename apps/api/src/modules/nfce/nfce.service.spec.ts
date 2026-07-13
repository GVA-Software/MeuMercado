import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { Produto } from '@meumercado/domain';
import type { ProdutoRepository } from '../catalog/produtos.repository.js';
import type { PriceObservationRepository } from '../pricing/price-observation.repository.js';
import type { GeocodeService } from '../geocode/geocode.service.js';
import type { ComprasService } from '../compras/compras.service.js';
import { InMemoryNfceImportRepository } from './nfce-import.repository.js';
import { NfceService } from './nfce.service.js';

const CHAVE = '3'.repeat(44);
const REQ = {
  mercadoNome: 'Mercado X',
  chave: CHAVE,
  itens: [{ nome: 'ARROZ TIO JOAO', priceCents: 2500, quantidade: 1 }],
};

function make(comprasRegistrar?: () => Promise<unknown>) {
  const produtos: Produto[] = [];
  const prodRepo = {
    findAll: () => Promise.resolve(produtos),
    findById: (id: string) => Promise.resolve(produtos.find((p) => p.id === id) ?? null),
    search: () => Promise.resolve([]),
    add: (p: Produto) => {
      produtos.push(p);
      return Promise.resolve();
    },
    delete: () => Promise.resolve(),
  } as unknown as ProdutoRepository;
  const obsAdd = vi.fn(() => Promise.resolve());
  const obsRepo = {
    all: () => Promise.resolve([]),
    findByProduto: () => Promise.resolve([]),
    add: obsAdd,
    reassignProduto: () => Promise.resolve(),
  } as unknown as PriceObservationRepository;
  const imports = new InMemoryNfceImportRepository();
  const geocode = {} as unknown as GeocodeService;
  const comprasReg = vi.fn(comprasRegistrar ?? (() => Promise.resolve({})));
  const compras = { registrar: comprasReg } as unknown as ComprasService;
  const service = new NfceService(prodRepo, obsRepo, imports, geocode, compras);
  return { service, obsAdd, comprasReg, imports };
}

describe('NfceService.importar — dedup atômico', () => {
  it('importa 1×; a 2ª (mesma chave) é rejeitada sem duplicar preços/compra', async () => {
    const { service, obsAdd, comprasReg } = make();
    const r1 = await service.importar(REQ, 'u1');
    expect(r1.importados).toBe(1);
    expect(obsAdd).toHaveBeenCalledTimes(1);
    expect(comprasReg).toHaveBeenCalledTimes(1);

    await expect(service.importar(REQ, 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(obsAdd).toHaveBeenCalledTimes(1); // NÃO duplicou
    expect(comprasReg).toHaveBeenCalledTimes(1);
  });

  it('rollback: se a gravação falha, a chave é liberada para tentar de novo', async () => {
    const { service, imports } = make(() => Promise.reject(new Error('boom')));
    await expect(service.importar(REQ, 'u1')).rejects.toThrow('boom');
    // A trava foi revertida — o usuário consegue reimportar.
    expect(await imports.jaImportada(CHAVE)).toBe(false);
  });
});
