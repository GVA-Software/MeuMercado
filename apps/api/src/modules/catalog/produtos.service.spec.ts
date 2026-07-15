import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Produto } from '@meumercado/domain';
import type { PriceObservationRepository } from '../pricing/price-observation.repository.js';
import type { ProdutoRepository } from './produtos.repository.js';
import type { OpenFoodFactsService } from './openfoodfacts.service.js';
import { ProdutosService } from './produtos.service.js';

const produto = (id: string, nome: string, ean?: string) =>
  new Produto({ id, nome, categoria: 'Outros', unidade: 'un', ...(ean ? { ean } : {}) });

function makeService(produtos: Produto[], offNome: string | null = null) {
  const reassigned: Array<[string, string]> = [];
  const deleted: string[] = [];
  const obsRepo: PriceObservationRepository = {
    all: () => Promise.resolve([]),
    findByProduto: () => Promise.resolve([]),
    add: () => Promise.resolve(),
    reassignProduto: (from, to) => {
      reassigned.push([from, to]);
      return Promise.resolve();
    },
    reassignMercado: () => Promise.resolve(),
    deleteByProduto: () => Promise.resolve(),
    deleteByMercado: () => Promise.resolve(),
  };
  const prodRepo: ProdutoRepository = {
    findAll: () => Promise.resolve(produtos),
    findById: (id) => Promise.resolve(produtos.find((p) => p.id === id) ?? null),
    findByEan: (ean) => Promise.resolve(produtos.find((p) => p.ean === ean) ?? null),
    search: () => Promise.resolve([]),
    add: () => Promise.resolve(),
    delete: (id) => {
      deleted.push(id);
      return Promise.resolve();
    },
  };
  const off = { nomePorEan: () => Promise.resolve(offNome) } as unknown as OpenFoodFactsService;
  return { service: new ProdutosService(prodRepo, obsRepo, off), reassigned, deleted };
}

describe('ProdutosService.merge', () => {
  it('move os preços do duplicado para o destino e remove o duplicado', async () => {
    const { service, reassigned, deleted } = makeService([
      produto('a', 'OLEO SOJA LIZA'),
      produto('b', 'OLEO LIZA 900ML SOJA'),
    ]);
    const res = await service.merge('a', 'b');
    expect(res.nome).toBe('OLEO LIZA 900ML SOJA'); // destino é o que fica
    expect(reassigned).toEqual([['a', 'b']]);
    expect(deleted).toEqual(['a']);
  });

  it('recusa juntar um produto nele mesmo', async () => {
    const { service } = makeService([produto('a', 'X')]);
    await expect(service.merge('a', 'a')).rejects.toThrow();
  });

  it('erro quando algum dos produtos não existe', async () => {
    const { service } = makeService([produto('a', 'X')]);
    await expect(service.merge('a', 'inexistente')).rejects.toThrow();
    await expect(service.merge('inexistente', 'a')).rejects.toThrow();
  });
});

describe('ProdutosService.lookupPorEan (bipar)', () => {
  it('EAN já no catálogo → devolve o produto, sem consultar o OFF', async () => {
    const { service } = makeService(
      [produto('p1', 'LEITE MOÇA 395G', '7891000315507')],
      'DEVERIA_IGNORAR',
    );
    const r = await service.lookupPorEan('7891000315507');
    expect(r.produto?.nome).toBe('LEITE MOÇA 395G');
    expect(r.produto?.ean).toBe('7891000315507'); // ean serializado no DTO
    expect(r.sugestaoNome).toBeNull();
  });

  it('EAN novo mas no OFF → sugere o nome, sem criar produto', async () => {
    const { service } = makeService([], 'Leite Condensado Moça 395g');
    const r = await service.lookupPorEan('7891000315507');
    expect(r.produto).toBeNull();
    expect(r.sugestaoNome).toBe('Leite Condensado Moça 395g');
  });

  it('EAN desconhecido em tudo → ambos nulos', async () => {
    const { service } = makeService([], null);
    const r = await service.lookupPorEan('0000000000000');
    expect(r.produto).toBeNull();
    expect(r.sugestaoNome).toBeNull();
  });
});
