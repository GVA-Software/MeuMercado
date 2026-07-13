import { describe, expect, it } from 'vitest';
import type { CompraDTO } from '@meumercado/contracts';
import { InMemoryCompraRepository } from './compra.repository.js';

const compra = (id: string): CompraDTO => ({
  id,
  mercadoId: null,
  mercadoNome: null,
  mercadoEndereco: null,
  totalCents: 1000,
  economiaCents: 0,
  itens: [],
  criadaEm: '2026-07-12T00:00:00.000Z',
});

describe('InMemoryCompraRepository — exclusão', () => {
  it('exclui só a compra do próprio usuário', async () => {
    const r = new InMemoryCompraRepository();
    await r.salvar('u1', compra('a'));
    await r.salvar('u1', compra('b'));
    await r.salvar('u2', compra('c'));

    await r.excluir('u1', 'a');
    expect((await r.listarPorUsuario('u1')).map((c) => c.id)).toEqual(['b']);
    expect((await r.listarPorUsuario('u2')).map((c) => c.id)).toEqual(['c']); // intacto
  });

  it('excluirTodas limpa só as do usuário', async () => {
    const r = new InMemoryCompraRepository();
    await r.salvar('u1', compra('a'));
    await r.salvar('u2', compra('b'));

    await r.excluirTodas('u1');
    expect(await r.listarPorUsuario('u1')).toEqual([]);
    expect((await r.listarPorUsuario('u2')).map((c) => c.id)).toEqual(['b']);
  });
});
