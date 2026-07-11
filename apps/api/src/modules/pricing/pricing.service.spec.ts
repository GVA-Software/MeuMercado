import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Money, PriceObservation, Produto } from '@meumercado/domain';
import type { PriceObservationRepository } from './price-observation.repository.js';
import type { ProdutoRepository } from '../catalog/produtos.repository.js';
import { PricingService } from './pricing.service.js';

const AGORA = new Date('2026-07-11T12:00:00Z');
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);

const produto = (id: string, nome: string) =>
  new Produto({ id, nome, categoria: 'Outros', unidade: 'un' });

const obs = (
  produtoId: string,
  mercadoId: string,
  cents: number,
  dias: number,
  reporterId = 'u1',
) =>
  new PriceObservation({
    id: `${produtoId}-${mercadoId}-${dias}`,
    produtoId,
    mercadoId,
    mercadoNome: mercadoId === 'm1' ? 'Atacadão' : 'Rossi',
    price: Money.fromCents(cents),
    source: 'manual',
    reporterId,
    observedAt: diasAtras(dias),
  });

function makeService(observations: PriceObservation[], produtos: Produto[]): PricingService {
  const obsRepo: PriceObservationRepository = {
    all: () => Promise.resolve(observations),
    findByProduto: (id) => Promise.resolve(observations.filter((o) => o.produtoId === id)),
    add: () => Promise.resolve(),
    reassignProduto: () => Promise.resolve(),
  };
  const prodRepo: ProdutoRepository = {
    findAll: () => Promise.resolve(produtos),
    findById: (id) => Promise.resolve(produtos.find((p) => p.id === id) ?? null),
    search: () => Promise.resolve([]),
    add: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  };
  return new PricingService(obsRepo, prodRepo);
}

describe('PricingService.tabela — tendência adaptativa', () => {
  it('mostra tendência mesmo com dados antigos (fora da janela de 30 dias)', async () => {
    // Regressão do bug real: preços de ~1 mês atrás não podem virar trend=null.
    const service = makeService(
      [obs('p1', 'm1', 1690, 36), obs('p1', 'm1', 1750, 32)],
      [produto('p1', 'SACO LIXO')],
    );
    const table = await service.tabela(undefined, undefined, AGORA);
    expect(table).toHaveLength(1);
    expect(table[0]!.trend).toBe('subiu');
    expect(table[0]!.trendPct).toBeGreaterThan(0);
  });

  it('ignora observações do seed (não aparecem na tabela)', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1690, 36, 'seed'), obs('p1', 'm1', 1750, 32, 'seed')],
      [produto('p1', 'SACO LIXO')],
    );
    expect(await service.tabela(undefined, undefined, AGORA)).toHaveLength(0);
  });

  it('filtra por mercado', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 10), obs('p2', 'm2', 2000, 10)],
      [produto('p1', 'Arroz'), produto('p2', 'Feijão')],
    );
    const soM2 = await service.tabela(undefined, 'Rossi', AGORA);
    expect(soM2.map((r) => r.produto.nome)).toEqual(['Feijão']);
  });
});

describe('PricingService.mercados', () => {
  it('conta observações por mercado, mais reportados primeiro', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 5), obs('p2', 'm1', 1100, 5), obs('p3', 'm2', 900, 5)],
      [],
    );
    const mercados = await service.mercados();
    expect(mercados).toEqual([
      { nome: 'Atacadão', count: 2 },
      { nome: 'Rossi', count: 1 },
    ]);
  });
});
