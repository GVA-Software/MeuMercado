import { Inject, Injectable } from '@nestjs/common';
import { Produto } from '@meumercado/domain';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';
import { semAcento } from '../../common/texto.js';

/**
 * Porta de acesso a produtos (implementação trocável: memória → Postgres).
 * Assíncrona porque a implementação persistente (TypeORM) é async.
 */
export interface ProdutoRepository {
  findAll(): Promise<Produto[]>;
  findById(id: string): Promise<Produto | null>;
  search(termo: string, limit: number): Promise<Produto[]>;
  add(produto: Produto): Promise<void>;
  /** Remove um produto do catálogo (usado ao juntar duplicados). */
  delete(id: string): Promise<void>;
}

export const PRODUTO_REPOSITORY = 'PRODUTO_REPOSITORY';

@Injectable()
export class InMemoryProdutoRepository implements ProdutoRepository {
  private readonly produtos: Produto[];

  constructor(@Inject(SEED_DATA) seed: SeedData) {
    this.produtos = [...seed.produtos];
  }

  findAll(): Promise<Produto[]> {
    return Promise.resolve(this.produtos);
  }

  findById(id: string): Promise<Produto | null> {
    return Promise.resolve(this.produtos.find((p) => p.id === id) ?? null);
  }

  search(termo: string, limit: number): Promise<Produto[]> {
    const t = semAcento(termo);
    if (t.length === 0) return Promise.resolve([]);
    return Promise.resolve(
      this.produtos.filter((p) => semAcento(p.nome).includes(t)).slice(0, limit),
    );
  }

  add(produto: Produto): Promise<void> {
    this.produtos.push(produto);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    const i = this.produtos.findIndex((p) => p.id === id);
    if (i >= 0) this.produtos.splice(i, 1);
    return Promise.resolve();
  }
}
