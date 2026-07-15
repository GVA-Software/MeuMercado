import { Inject, Injectable } from '@nestjs/common';
import { Produto, type Categoria } from '@meumercado/domain';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';
import { combinaBusca } from '../../common/texto.js';

/**
 * Porta de acesso a produtos (implementação trocável: memória → Postgres).
 * Assíncrona porque a implementação persistente (TypeORM) é async.
 */
export interface ProdutoRepository {
  findAll(): Promise<Produto[]>;
  findById(id: string): Promise<Produto | null>;
  /** Casa por código de barras (EAN) — usado ao bipar um produto. */
  findByEan(ean: string): Promise<Produto | null>;
  search(termo: string, limit: number): Promise<Produto[]>;
  add(produto: Produto): Promise<void>;
  /**
   * Atualiza nome/categoria de um produto. Retorna `false` se não deu pra editar
   * (não existe, ou é item fixo da base). Usado na correção pós-merge.
   */
  atualizar(id: string, campos: { nome: string; categoria: Categoria }): Promise<boolean>;
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

  findByEan(ean: string): Promise<Produto | null> {
    return Promise.resolve(this.produtos.find((p) => p.ean === ean) ?? null);
  }

  search(termo: string, limit: number): Promise<Produto[]> {
    return Promise.resolve(
      this.produtos.filter((p) => combinaBusca(p.nome, termo)).slice(0, limit),
    );
  }

  add(produto: Produto): Promise<void> {
    this.produtos.push(produto);
    return Promise.resolve();
  }

  atualizar(id: string, campos: { nome: string; categoria: Categoria }): Promise<boolean> {
    const i = this.produtos.findIndex((p) => p.id === id);
    if (i < 0) return Promise.resolve(false);
    const p = this.produtos[i]!;
    this.produtos[i] = new Produto({
      id: p.id,
      nome: campos.nome,
      categoria: campos.categoria,
      unidade: p.unidade,
      ...(p.emoji !== undefined ? { emoji: p.emoji } : {}),
      ...(p.codigoExterno !== undefined ? { codigoExterno: p.codigoExterno } : {}),
      ...(p.ean !== undefined ? { ean: p.ean } : {}),
    });
    return Promise.resolve(true);
  }

  delete(id: string): Promise<void> {
    const i = this.produtos.findIndex((p) => p.id === id);
    if (i >= 0) this.produtos.splice(i, 1);
    return Promise.resolve();
  }
}
