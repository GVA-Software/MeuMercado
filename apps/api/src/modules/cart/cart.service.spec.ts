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
  const reportado: Array<{ produtoId: string; mercadoId: string; priceCents: number }> = [];
  const pricing = {
    reportar: (obs: { produtoId: string; mercadoId: string; priceCents: number }) => {
      reportado.push({
        produtoId: obs.produtoId,
        mercadoId: obs.mercadoId,
        priceCents: obs.priceCents,
      });
      return Promise.resolve();
    },
  } as unknown as PricingService;
  const compras = {} as unknown as ComprasService;
  return { service: new CartService(store, pricing, compras), store, reportado };
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

describe('CartService — lista de compras (planejar → riscar → base)', () => {
  it('item sem preço entra PLANEJADO; ao riscar, vira comprado e alimenta a base', async () => {
    const { service, reportado } = make();
    const cart = await service.criar('userA');
    await service.definirMercado(cart.id, 'userA', {
      id: 'm-1',
      nome: 'Mercado Bom Preço',
      lat: -23.5,
      lng: -46.6,
    });

    // Adiciona SEM preço → item planejado (não soma, não reporta).
    const comItem = await service.adicionarItem(
      cart.id,
      { produtoId: 'p-arroz', nome: 'Arroz', quantity: 2 },
      'userA',
    );
    const linha = comItem.items[0]!;
    expect(linha.comprado).toBe(false);
    expect(linha.unitPrice).toBeNull();
    expect(comItem.total.cents).toBe(0);
    expect(reportado).toHaveLength(0);

    // Risca: grava preço + qtd, soma no total e reporta à base com o mercado.
    const riscado = await service.marcarComprado(cart.id, 'userA', linha.lineId, 599, 3);
    expect(riscado.items[0]!.comprado).toBe(true);
    expect(riscado.total.cents).toBe(1797); // 5,99 × 3
    expect(reportado).toEqual([{ produtoId: 'p-arroz', mercadoId: 'm-1', priceCents: 599 }]);

    // Desmarca: volta a planejado (o preço já reportado permanece na base).
    const voltou = await service.desmarcar(cart.id, 'userA', linha.lineId);
    expect(voltou.items[0]!.comprado).toBe(false);
    expect(voltou.total.cents).toBe(0);
    expect(reportado).toHaveLength(1);
  });
});
