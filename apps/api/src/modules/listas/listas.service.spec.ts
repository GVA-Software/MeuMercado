import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LISTA_MAX_POR_USUARIO, type SavedListItemDTO } from '@meumercado/contracts';
import { InMemoryListaRepository } from './lista.repository.js';
import { ListasService } from './listas.service.js';

const item = (n: string): SavedListItemDTO => ({ produtoId: `p-${n}`, nome: n, quantity: 1 });

function make() {
  return new ListasService(new InMemoryListaRepository());
}

describe('ListasService', () => {
  it('salva, lista, obtém e exclui — tudo escopado ao dono', async () => {
    const service = make();
    const salva = await service.salvar('userA', '  Compra do mês  ', [
      item('Arroz'),
      item('Feijão'),
    ]);
    expect(salva.nome).toBe('Compra do mês'); // trim
    expect(salva.itens).toHaveLength(2);

    expect(await service.listar('userA')).toHaveLength(1);
    expect(await service.listar('userB')).toHaveLength(0); // não vaza p/ outro dono
    expect((await service.obter('userA', salva.id))?.id).toBe(salva.id);
    expect(await service.obter('userB', salva.id)).toBeNull(); // dono errado não acha

    await service.excluir('userA', salva.id);
    expect(await service.listar('userA')).toHaveLength(0);
  });

  it('recusa salvar lista vazia', async () => {
    const service = make();
    await expect(service.salvar('userA', 'Vazia', [])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa passar do limite de listas por usuário', async () => {
    const service = make();
    for (let i = 0; i < LISTA_MAX_POR_USUARIO; i += 1) {
      await service.salvar('userA', `Lista ${i}`, [item(`x${i}`)]);
    }
    await expect(service.salvar('userA', 'Mais uma', [item('y')])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
