import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  LISTA_MAX_ITENS,
  LISTA_MAX_POR_USUARIO,
  type SavedListDTO,
  type SavedListItemDTO,
} from '@meumercado/contracts';
import { LISTA_REPOSITORY, type ListaRepository } from './lista.repository.js';

@Injectable()
export class ListasService {
  constructor(@Inject(LISTA_REPOSITORY) private readonly repo: ListaRepository) {}

  /** Salva a lista atual como um modelo nomeado (respeitando os limites). */
  async salvar(
    userId: string,
    nome: string,
    itens: readonly SavedListItemDTO[],
  ): Promise<SavedListDTO> {
    if (itens.length === 0) {
      throw new BadRequestException('A lista está vazia — adicione itens antes de salvar.');
    }
    if (itens.length > LISTA_MAX_ITENS) {
      throw new BadRequestException(`Uma lista pode ter no máximo ${LISTA_MAX_ITENS} itens.`);
    }
    if ((await this.repo.contarPorUsuario(userId)) >= LISTA_MAX_POR_USUARIO) {
      throw new BadRequestException(
        `Você atingiu o limite de ${LISTA_MAX_POR_USUARIO} listas salvas. Apague uma antes de salvar outra.`,
      );
    }
    const lista: SavedListDTO = {
      id: randomUUID(),
      nome: nome.trim().slice(0, 60),
      itens: itens.map((i) => ({
        produtoId: i.produtoId,
        nome: i.nome,
        ...(i.emoji !== undefined ? { emoji: i.emoji } : {}),
        quantity: i.quantity,
      })),
      criadaEm: new Date().toISOString(),
    };
    await this.repo.salvar(userId, lista);
    return lista;
  }

  listar(userId: string): Promise<SavedListDTO[]> {
    return this.repo.listarPorUsuario(userId);
  }

  /** Uma lista específica do usuário (ou null). Usada pelo carrinho ao "usar lista". */
  async obter(userId: string, listaId: string): Promise<SavedListDTO | null> {
    const todas = await this.repo.listarPorUsuario(userId);
    return todas.find((l) => l.id === listaId) ?? null;
  }

  excluir(userId: string, listaId: string): Promise<void> {
    return this.repo.excluir(userId, listaId);
  }
}
