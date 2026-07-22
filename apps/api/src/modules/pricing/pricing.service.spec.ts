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
  lat?: number,
  lng?: number,
  endereco?: string,
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
    ...(lat !== undefined ? { mercadoLat: lat } : {}),
    ...(lng !== undefined ? { mercadoLng: lng } : {}),
    ...(endereco !== undefined ? { mercadoEndereco: endereco } : {}),
  });

function makeService(observations: PriceObservation[], produtos: Produto[]): PricingService {
  const obsRepo: PriceObservationRepository = {
    all: () => Promise.resolve(observations),
    findByProduto: (id) => Promise.resolve(observations.filter((o) => o.produtoId === id)),
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
    findById: (id) => Promise.resolve(produtos.find((p) => p.id === id) ?? null),
    findByEan: () => Promise.resolve(null),
    search: () => Promise.resolve([]),
    add: () => Promise.resolve(),
    atualizar: () => Promise.resolve(true),
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
    const table = await service.tabela(undefined, undefined, undefined, AGORA);
    expect(table).toHaveLength(1);
    expect(table[0]!.trend).toBe('subiu');
    expect(table[0]!.trendPct).toBeGreaterThan(0);
  });

  it('ignora observações do seed (não aparecem na tabela)', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1690, 36, 'seed'), obs('p1', 'm1', 1750, 32, 'seed')],
      [produto('p1', 'SACO LIXO')],
    );
    expect(await service.tabela(undefined, undefined, undefined, AGORA)).toHaveLength(0);
  });

  it('filtra por mercado', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 10), obs('p2', 'm2', 2000, 10)],
      [produto('p1', 'Arroz'), produto('p2', 'Feijão')],
    );
    const soM2 = await service.tabela(undefined, 'Rossi', undefined, AGORA);
    expect(soM2.map((r) => r.produto.nome)).toEqual(['Feijão']);
  });
});

describe('PricingService.paraCompletar — mutirão de cobertura', () => {
  it('traz só produtos com preço em 1 mercado (exclui os já comparáveis)', async () => {
    const service = makeService(
      [
        obs('p1', 'm1', 1000, 5), // 1 mercado → entra
        obs('p2', 'm1', 2000, 5), // 2 mercados → NÃO entra
        obs('p2', 'm2', 2100, 4),
      ],
      [produto('p1', 'Arroz'), produto('p2', 'Feijão')],
    );
    const lista = await service.paraCompletar();
    expect(lista.map((r) => r.produto.nome)).toEqual(['Arroz']);
    expect(lista[0]!.mercadoNome).toBe('Atacadão');
    expect(lista[0]!.precoCents).toBe(1000);
  });

  it('ordena pelos mais caros primeiro (onde comparar rende mais)', async () => {
    const service = makeService(
      [obs('p1', 'm1', 500, 5), obs('p2', 'm1', 3000, 5), obs('p3', 'm2', 1500, 5)],
      [produto('p1', 'Sal'), produto('p2', 'Café'), produto('p3', 'Arroz')],
    );
    const lista = await service.paraCompletar();
    expect(lista.map((r) => r.produto.nome)).toEqual(['Café', 'Arroz', 'Sal']);
  });

  it('ignora seed e observações órfãs (produto fora do catálogo)', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 5, 'seed'), obs('orfao', 'm1', 999, 5)],
      [produto('p1', 'Arroz')], // 'orfao' não está no catálogo
    );
    expect(await service.paraCompletar()).toEqual([]);
  });
});

describe('PricingService.estimativa — prévia da lista', () => {
  it('soma média × quantidade e lista os produtos sem preço', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 5), obs('p1', 'm2', 2000, 5)], // média p1 = 1500
      [produto('p1', 'Arroz'), produto('p2', 'Feijão')],
    );
    const r = await service.estimativa([
      { produtoId: 'p1', quantity: 2 }, // 1500 × 2 = 3000
      { produtoId: 'p2', quantity: 1 }, // sem preço na base
    ]);
    expect(r.totalEstimadoCents).toBe(3000);
    expect(r.semPreco).toEqual(['p2']);
    expect(r.itens.find((i) => i.produtoId === 'p1')!.mediaCents).toBe(1500);
    expect(r.itens.find((i) => i.produtoId === 'p2')!.mediaCents).toBeNull();
  });

  it('ignora o seed no cálculo (conta como sem preço)', async () => {
    const service = makeService([obs('p1', 'm1', 1000, 5, 'seed')], [produto('p1', 'Arroz')]);
    const r = await service.estimativa([{ produtoId: 'p1', quantity: 3 }]);
    expect(r.totalEstimadoCents).toBe(0);
    expect(r.semPreco).toEqual(['p1']);
    expect(r.mercados).toEqual([]);
  });

  it('ranqueia mercados: mais completo primeiro, depois mais barato + economia vs média', async () => {
    const service = makeService(
      // p1 em m1=1000 e m2=1200 (média 1100); p2 só em m1=500 (média 500)
      [obs('p1', 'm1', 1000, 5), obs('p1', 'm2', 1200, 5), obs('p2', 'm1', 500, 5)],
      [produto('p1', 'Arroz'), produto('p2', 'Feijão')],
    );
    const r = await service.estimativa([
      { produtoId: 'p1', quantity: 1 },
      { produtoId: 'p2', quantity: 2 },
    ]);
    expect(r.totalItens).toBe(2);
    // m1 cobre os 2 (1000 + 500×2 = 2000); m2 cobre só p1 (1200). Mais completo primeiro.
    expect(r.mercados[0]).toMatchObject({ mercadoId: 'm1', itensCobertos: 2, totalCents: 2000 });
    expect(r.mercados[1]).toMatchObject({ mercadoId: 'm2', itensCobertos: 1, totalCents: 1200 });
    // média coberta em m1 = 1100×1 + 500×2 = 2100; total 2000 → economia 100.
    expect(r.mercados[0]!.economiaVsMediaCents).toBe(100);
  });

  it('colapsa linhas do mesmo produto: cobertura conta produto DISTINTO, soma a quantidade', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 5), obs('p2', 'm1', 500, 5)],
      [produto('p1', 'Arroz'), produto('p2', 'Feijão')],
    );
    // Duas linhas de p1 (qty 1 + 2) + uma de p2 (qty 1).
    const r = await service.estimativa([
      { produtoId: 'p1', quantity: 1 },
      { produtoId: 'p1', quantity: 2 },
      { produtoId: 'p2', quantity: 1 },
    ]);
    expect(r.totalItens).toBe(2); // produtos distintos, não 3 linhas
    expect(r.mercados[0]!.itensCobertos).toBe(2); // p1 não conta 2x
    expect(r.mercados[0]!.totalCents).toBe(1000 * 3 + 500 * 1); // p1 qty somada = 3
  });

  it('usa o preço MAIS RECENTE por mercado (não a média) no total do mercado', async () => {
    const service = makeService(
      [obs('p1', 'm1', 2000, 10), obs('p1', 'm1', 800, 1)], // recente = 800
      [produto('p1', 'Arroz')],
    );
    const r = await service.estimativa([{ produtoId: 'p1', quantity: 1 }]);
    expect(r.mercados[0]!.totalCents).toBe(800);
  });

  it('expõe endereço/coordenadas do mercado e calcula a distância quando recebe a posição', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 5, 'u1', -23.6, -46.7, 'Av. Teste, 100')],
      [produto('p1', 'Arroz')],
    );
    const r = await service.estimativa([{ produtoId: 'p1', quantity: 1 }], {
      lat: -23.55,
      lng: -46.63,
    });
    expect(r.mercados[0]!.mercadoEndereco).toBe('Av. Teste, 100');
    expect(r.mercados[0]!.mercadoLat).toBe(-23.6);
    expect(r.mercados[0]!.mercadoLng).toBe(-46.7);
    expect(r.mercados[0]!.distanciaMetros).toBeGreaterThan(0);
  });

  it('mantém as coordenadas do mercado mesmo quando a observação mais recente não tem geo', async () => {
    const service = makeService(
      [
        obs('p1', 'm1', 1000, 5), // mais recente em m1, SEM geo (reporte manual)
        obs('p2', 'm1', 500, 10, 'u1', -23.6, -46.7, 'Av. Teste, 100'), // mais antiga, COM geo
      ],
      [produto('p1', 'Arroz'), produto('p2', 'Feijão')],
    );
    const r = await service.estimativa(
      [
        { produtoId: 'p1', quantity: 1 },
        { produtoId: 'p2', quantity: 1 },
      ],
      { lat: -23.55, lng: -46.63 },
    );
    const m1 = r.mercados.find((m) => m.mercadoId === 'm1')!;
    expect(m1.mercadoLat).toBe(-23.6);
    expect(m1.mercadoLng).toBe(-46.7);
    expect(m1.mercadoEndereco).toBe('Av. Teste, 100');
    expect(m1.distanciaMetros).toBeGreaterThan(0);
  });

  it('sem posição: distância vem null (coordenadas do mercado seguem expostas)', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 5, 'u1', -23.6, -46.7)],
      [produto('p1', 'Arroz')],
    );
    const r = await service.estimativa([{ produtoId: 'p1', quantity: 1 }]);
    expect(r.mercados[0]!.distanciaMetros).toBeNull();
    expect(r.mercados[0]!.mercadoLat).toBe(-23.6);
    expect(r.mercados[0]!.mercadoEndereco).toBeNull();
  });
});

describe('PricingService.tabela — proximidade', () => {
  it('sem posição: distâncias vêm null; a coord do mercado mais barato é exposta', async () => {
    const service = makeService(
      [obs('p1', 'm1', 1000, 5, 'u1', -23.5, -46.6)],
      [produto('p1', 'Arroz')],
    );
    const t = await service.tabela();
    expect(t[0]!.distanciaMetros).toBeNull();
    expect(t[0]!.distanciaMaisProximoMetros).toBeNull();
    expect(t[0]!.menorPrecoLat).toBe(-23.5);
    expect(t[0]!.menorPrecoLng).toBe(-46.6);
  });

  it('com posição: distância ao mais barato + a MENOR entre todas as observações', async () => {
    const service = makeService(
      [
        obs('p1', 'm1', 500, 5, 'u1', -23.6, -46.7), // mais barato, longe
        obs('p1', 'm2', 900, 5, 'u1', -23.55, -46.63), // mais caro, colado no usuário
      ],
      [produto('p1', 'Arroz')],
    );
    const t = await service.tabela(undefined, undefined, { lat: -23.55, lng: -46.63 });
    expect(t[0]!.distanciaMetros).toBeGreaterThan(0); // ao mais barato (m1, longe)
    expect(t[0]!.distanciaMaisProximoMetros).toBeLessThan(100); // o mais próximo (m2) ~em cima
    expect(t[0]!.distanciaMaisProximoMetros!).toBeLessThan(t[0]!.distanciaMetros!);
  });

  it('observação sem coord não quebra (distâncias null)', async () => {
    const service = makeService([obs('p1', 'm1', 1000, 5)], [produto('p1', 'Arroz')]);
    const t = await service.tabela(undefined, undefined, { lat: -23.5, lng: -46.6 });
    expect(t[0]!.distanciaMetros).toBeNull();
    expect(t[0]!.distanciaMaisProximoMetros).toBeNull();
    expect(t[0]!.menorPrecoLat).toBeNull();
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
