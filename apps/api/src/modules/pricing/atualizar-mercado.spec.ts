import { describe, it, expect } from 'vitest';
import { Money, PriceObservation } from '@meumercado/domain';
import type { SeedData } from '../../data/seed.js';
import { InMemoryPriceObservationRepository } from './price-observation.repository.js';

describe('InMemoryPriceObservationRepository.atualizarMercado', () => {
  it('PRESERVA a coordenada ao editar nome/endereço (não zera → mercado não some do mapa)', async () => {
    const repo = new InMemoryPriceObservationRepository({
      mercados: [],
      observations: [],
    } as unknown as SeedData);
    await repo.add(
      new PriceObservation({
        id: 'o1',
        produtoId: 'p1',
        mercadoId: 'm1',
        price: Money.fromCents(500),
        source: 'qr',
        reporterId: 'u1',
        observedAt: new Date('2026-07-01T00:00:00Z'),
        mercadoNome: 'Atacadão',
        mercadoEndereco: 'Rua X',
        mercadoLat: -23.53,
        mercadoLng: -46.76,
      }),
    );

    // Editar (renomear/corrigir endereço) NÃO pode apagar a coordenada — foi a causa
    // do "ontem tinha, hoje sumiu" (o mercado ficava invisível até re-geocodar).
    await repo.atualizarMercado('m1', 'Atacadão Osasco', 'Av dos Autonomistas, 1542');

    const [m] = await repo.mercadosComPreco();
    expect(m!.nome).toBe('Atacadão Osasco');
    expect(m!.lat).toBe(-23.53);
    expect(m!.lng).toBe(-46.76);
  });
});
