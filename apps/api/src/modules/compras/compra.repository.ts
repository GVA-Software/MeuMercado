import { Injectable } from '@nestjs/common';
import type { CompraDTO } from '@meumercado/contracts';

/** Compras finalizadas por usuário (histórico pessoal de gastos). */
export interface CompraRepository {
  salvar(userId: string, compra: CompraDTO): Promise<void>;
  listarPorUsuario(userId: string): Promise<CompraDTO[]>;
  /** Exclui UMA compra do usuário (só a dele). */
  excluir(userId: string, compraId: string): Promise<void>;
  /** Exclui TODAS as compras do usuário. */
  excluirTodas(userId: string): Promise<void>;
}

export const COMPRA_REPOSITORY = 'COMPRA_REPOSITORY';

@Injectable()
export class InMemoryCompraRepository implements CompraRepository {
  private readonly compras: Array<{ userId: string; compra: CompraDTO }> = [];

  salvar(userId: string, compra: CompraDTO): Promise<void> {
    this.compras.push({ userId, compra });
    return Promise.resolve();
  }

  listarPorUsuario(userId: string): Promise<CompraDTO[]> {
    return Promise.resolve(
      this.compras
        .filter((c) => c.userId === userId)
        .map((c) => c.compra)
        .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)),
    );
  }

  excluir(userId: string, compraId: string): Promise<void> {
    const i = this.compras.findIndex((c) => c.userId === userId && c.compra.id === compraId);
    if (i >= 0) this.compras.splice(i, 1);
    return Promise.resolve();
  }

  excluirTodas(userId: string): Promise<void> {
    for (let i = this.compras.length - 1; i >= 0; i -= 1) {
      if (this.compras[i]!.userId === userId) this.compras.splice(i, 1);
    }
    return Promise.resolve();
  }
}
