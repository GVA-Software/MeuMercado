import { Injectable } from '@nestjs/common';
import type { CompraDTO } from '@meumercado/contracts';

/** Compras finalizadas por usuário (histórico pessoal de gastos). */
export interface CompraRepository {
  salvar(userId: string, compra: CompraDTO): Promise<void>;
  listarPorUsuario(userId: string): Promise<CompraDTO[]>;
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
}
