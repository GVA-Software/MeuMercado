import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Cart } from '@meumercado/domain';
import type { CompraDTO } from '@meumercado/contracts';
import type { PricingService } from '../pricing/pricing.service.js';
import type { ComprasService } from '../compras/compras.service.js';
import type { ListasService } from '../listas/listas.service.js';
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
  const listas = {} as unknown as ListasService;
  return { service: new CartService(store, pricing, compras, listas), store, reportado };
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

  it('trava o mercado depois de riscar: não remove nem troca (reconfirmar o mesmo é ok)', async () => {
    const { service } = make();
    const cart = await service.criar('userA');
    await service.definirMercado(cart.id, 'userA', { id: 'm-1', nome: 'Mercado A' });
    const comItem = await service.adicionarItem(
      cart.id,
      { produtoId: 'p', nome: 'Arroz', quantity: 1 },
      'userA',
    );
    await service.marcarComprado(cart.id, 'userA', comItem.items[0]!.lineId, 500, 1);

    // Remover → bloqueado.
    await expect(service.definirMercado(cart.id, 'userA', null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Trocar por outro → bloqueado.
    await expect(
      service.definirMercado(cart.id, 'userA', { id: 'm-2', nome: 'Mercado B' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Reconfirmar o MESMO mercado → permitido (idempotente).
    const ok = await service.definirMercado(cart.id, 'userA', { id: 'm-1', nome: 'Mercado A' });
    expect(ok.mercado?.id).toBe('m-1');
  });
});

describe('CartService — repetir última compra', () => {
  function makeCom(ultima: CompraDTO | null) {
    const store = new InMemoryCartStore();
    const pricing = { reportar: () => Promise.resolve() } as unknown as PricingService;
    const compras = { ultimaDe: () => Promise.resolve(ultima) } as unknown as ComprasService;
    const listas = {} as unknown as ListasService;
    return new CartService(store, pricing, compras, listas);
  }

  it('semeia a lista (planejados) com os itens da última compra, sem duplicar', async () => {
    const ultima = {
      itens: [
        { produtoId: 'p-arroz', nome: 'Arroz', unitPriceCents: 500, quantity: 2 },
        { produtoId: 'p-feijao', nome: 'Feijão', unitPriceCents: 800, quantity: 1 },
      ],
    } as unknown as CompraDTO;
    const service = makeCom(ultima);
    const cart = await service.criar('userA');
    // Já tem arroz na lista → não pode duplicar ao repetir.
    await service.adicionarItem(
      cart.id,
      { produtoId: 'p-arroz', nome: 'Arroz', quantity: 1 },
      'userA',
    );

    const r = await service.repetirUltima(cart.id, 'userA');
    expect(r.items.map((i) => i.produtoId).sort()).toEqual(['p-arroz', 'p-feijao']);
    expect(r.items.every((i) => !i.comprado)).toBe(true); // tudo planejado (sem preço)
    const feijao = r.items.find((i) => i.produtoId === 'p-feijao')!;
    expect(feijao.unitPrice).toBeNull();
    expect(feijao.quantity).toBe(1);
    expect(r.total.cents).toBe(0);
  });

  it('sem compra anterior → erro amigável (BadRequest)', async () => {
    const service = makeCom(null);
    const cart = await service.criar('userA');
    await expect(service.repetirUltima(cart.id, 'userA')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('CartService — usar lista salva', () => {
  function makeCom(lista: unknown) {
    const store = new InMemoryCartStore();
    const pricing = { reportar: () => Promise.resolve() } as unknown as PricingService;
    const compras = {} as unknown as ComprasService;
    const listas = {
      obter: (_u: string, id: string) => Promise.resolve(id === 'L1' ? lista : null),
    } as unknown as ListasService;
    return new CartService(store, pricing, compras, listas);
  }

  it('semeia o carrinho com os itens da lista salva (planejados, sem duplicar)', async () => {
    const lista = {
      id: 'L1',
      nome: 'Semana',
      criadaEm: '2026-07-10T12:00:00.000Z',
      itens: [
        { produtoId: 'p-arroz', nome: 'Arroz', quantity: 2 },
        { produtoId: 'p-leite', nome: 'Leite', quantity: 1 },
      ],
    };
    const service = makeCom(lista);
    const cart = await service.criar('userA');
    await service.adicionarItem(
      cart.id,
      { produtoId: 'p-arroz', nome: 'Arroz', quantity: 1 },
      'userA',
    );
    const r = await service.usarLista(cart.id, 'userA', 'L1');
    expect(r.items.map((i) => i.produtoId).sort()).toEqual(['p-arroz', 'p-leite']);
    expect(r.items.every((i) => !i.comprado)).toBe(true);
  });

  it('lista inexistente → 404', async () => {
    const service = makeCom(null);
    const cart = await service.criar('userA');
    await expect(service.usarLista(cart.id, 'userA', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
