import { Injectable } from '@nestjs/common';
import type { SavedListDTO } from '@meumercado/contracts';

/** Listas salvas por usuário (modelos reutilizáveis, dado pessoal privado). */
export interface ListaRepository {
  salvar(userId: string, lista: SavedListDTO): Promise<void>;
  listarPorUsuario(userId: string): Promise<SavedListDTO[]>;
  contarPorUsuario(userId: string): Promise<number>;
  /** Exclui UMA lista do usuário (só a dele). */
  excluir(userId: string, listaId: string): Promise<void>;
  /** Exclui TODAS as listas do usuário (cascade da exclusão de conta — LGPD). */
  excluirTodas(userId: string): Promise<void>;
}

export const LISTA_REPOSITORY = 'LISTA_REPOSITORY';

@Injectable()
export class InMemoryListaRepository implements ListaRepository {
  private readonly listas: Array<{ userId: string; lista: SavedListDTO }> = [];

  salvar(userId: string, lista: SavedListDTO): Promise<void> {
    this.listas.push({ userId, lista });
    return Promise.resolve();
  }

  listarPorUsuario(userId: string): Promise<SavedListDTO[]> {
    return Promise.resolve(
      this.listas
        .filter((l) => l.userId === userId)
        .map((l) => l.lista)
        .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)),
    );
  }

  contarPorUsuario(userId: string): Promise<number> {
    return Promise.resolve(this.listas.filter((l) => l.userId === userId).length);
  }

  excluir(userId: string, listaId: string): Promise<void> {
    const i = this.listas.findIndex((l) => l.userId === userId && l.lista.id === listaId);
    if (i >= 0) this.listas.splice(i, 1);
    return Promise.resolve();
  }

  excluirTodas(userId: string): Promise<void> {
    for (let i = this.listas.length - 1; i >= 0; i -= 1) {
      if (this.listas[i]!.userId === userId) this.listas.splice(i, 1);
    }
    return Promise.resolve();
  }
}
