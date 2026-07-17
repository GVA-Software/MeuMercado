import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Money, PriceObservation, Produto } from '@meumercado/domain';
import type { PriceObservationRepository } from '../pricing/price-observation.repository.js';
import type { ProdutoRepository } from '../catalog/produtos.repository.js';
import type { SeedData } from '../../data/seed.js';
import { InsightsService } from './insights.service.js';
import { InMemorySinonimoRepository } from './sinonimo.repository.js';
import { InMemoryReceitaRepository } from './receita.repository.js';

const produto = (id: string, nome: string) =>
  new Produto({ id, nome, categoria: 'Outros', unidade: 'un' });

const obs = (produtoId: string, reporterId = 'u1') =>
  new PriceObservation({
    id: `o-${produtoId}-${reporterId}`,
    produtoId,
    mercadoId: 'm1',
    mercadoNome: 'Atacadão',
    price: Money.fromCents(669),
    source: 'manual',
    reporterId,
    observedAt: new Date('2026-07-10T12:00:00Z'),
  });

function make(produtos: Produto[], observations: PriceObservation[]): InsightsService {
  const prices: PriceObservationRepository = {
    all: () => Promise.resolve(observations),
    findByProduto: () => Promise.resolve([]),
    add: () => Promise.resolve(),
    reassignProduto: () => Promise.resolve(),
    reassignMercado: () => Promise.resolve(),
    deleteByProduto: () => Promise.resolve(),
    deleteByMercado: () => Promise.resolve(),
    updatePreco: () => Promise.resolve(),
    deleteById: () => Promise.resolve(),
    moverObservacao: () => Promise.resolve(),
    mercadosComPreco: () => Promise.resolve([]),
    setMercadoCoords: () => Promise.resolve(),
    atualizarMercado: () => Promise.resolve(),
  };
  const prodRepo: ProdutoRepository = {
    findAll: () => Promise.resolve(produtos),
    findById: () => Promise.resolve(null),
    findByEan: () => Promise.resolve(null),
    search: () => Promise.resolve([]),
    add: () => Promise.resolve(),
    atualizar: () => Promise.resolve(true),
    delete: () => Promise.resolve(),
  };
  const seed = { mercados: [], produtos: [] } as unknown as SeedData;
  return new InsightsService(
    prices,
    prodRepo,
    seed,
    new InMemorySinonimoRepository(),
    new InMemoryReceitaRepository(),
  );
}

describe('InsightsService.buscarComPreco', () => {
  it('só retorna produtos com preço real (exclui o placeholder do seed)', async () => {
    const svc = make(
      [produto('oleo', 'Óleo de Soja 900ml'), produto('real', 'OLEO SOJA SOYA')],
      [obs('real')], // só o "real" tem preço; "oleo" é placeholder do seed
    );
    const r = await svc.buscarComPreco('oleo');
    expect(r.map((p) => p.id)).toEqual(['real']); // não oferece o beco sem saída
  });

  it('ignora observações do seed (não conta como "tem preço")', async () => {
    const svc = make([produto('x', 'Café')], [obs('x', 'seed')]);
    expect(await svc.buscarComPreco('cafe')).toEqual([]);
  });
});
