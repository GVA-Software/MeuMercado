import { Inject, Injectable } from '@nestjs/common';
import { Produto } from '@meumercado/domain';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';

/** Porta de acesso a produtos (implementação trocável: memória → PostGIS). */
export interface ProdutoRepository {
  findAll(): Produto[];
  findById(id: string): Produto | null;
  search(termo: string, limit: number): Produto[];
}

export const PRODUTO_REPOSITORY = 'PRODUTO_REPOSITORY';

@Injectable()
export class InMemoryProdutoRepository implements ProdutoRepository {
  private readonly produtos: Produto[];

  constructor(@Inject(SEED_DATA) seed: SeedData) {
    this.produtos = seed.produtos;
  }

  findAll(): Produto[] {
    return this.produtos;
  }

  findById(id: string): Produto | null {
    return this.produtos.find((p) => p.id === id) ?? null;
  }

  search(termo: string, limit: number): Produto[] {
    const t = termo.trim().toLowerCase();
    if (t.length === 0) return [];
    return this.produtos.filter((p) => p.nome.toLowerCase().includes(t)).slice(0, limit);
  }
}
