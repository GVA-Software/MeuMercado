import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Cart } from '@meumercado/domain';
import type { PricingService } from '../pricing/pricing.service.js';
import type { ComprasService } from '../compras/compras.service.js';
import { InMemoryCartStore } from './cart.store.js';
import { CartService } from './cart.service.js';

function make() {
  const store = new InMemoryCartStore();
  const pricing = { reportar: () => Promise.resolve() } as unknown as PricingService;
  const compras = {} as unknown as ComprasService;
  return { service: new CartService(store, pricing, compras), store };
}

describe('CartService — escopo por dono', () => {
  it('o dono acessa o próprio carrinho', async () => {
    const { service } = make();
    const criado = await service.criar('userA');
    const lido = await service.obter(criado.id, 'userA');
    expect(lido.id).toBe(criado.id);
  });

  it('OUTRO usuário não acessa o carrinho alheio (404)', async () => {
    const { service } = make();
    const criado = await service.criar('userA');
    await expect(service.obter(criado.id, 'userB')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adota carrinho legado (sem dono) para o primeiro usuário que o acessa', async () => {
    const { service, store } = make();
    await store.save(new Cart({ id: 'legado-1' })); // sem userId
    const lido = await service.obter('legado-1', 'userA');
    expect(lido.id).toBe('legado-1');
    // Depois de adotado, vira privado: outro usuário não acessa mais.
    await expect(service.obter('legado-1', 'userB')).rejects.toBeInstanceOf(NotFoundException);
  });
});
