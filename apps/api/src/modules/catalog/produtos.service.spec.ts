import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Produto } from '@meumercado/domain';
import type { PriceObservationRepository } from '../pricing/price-observation.repository.js';
import type { ProdutoRepository } from './produtos.repository.js';
import { ProdutosService } from './produtos.service.js';

const produto = (id: string, nome: string) =>
  new Produto({ id, nome, categoria: 'Outros', unidade: 'un' });

function makeService(produtos: Produto[]) {
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
  };
  const prodRepo: ProdutoRepository = {
    findAll: () => Promise.resolve(produtos),
    findById: (id) => Promise.resolve(produtos.find((p) => p.id === id) ?? null),
    search: () => Promise.resolve([]),
    add: () => Promise.resolve(),
    delete: (id) => {
      deleted.push(id);
      return Promise.resolve();
    },
  };
  return { service: new ProdutosService(prodRepo, obsRepo), reassigned, deleted };
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
