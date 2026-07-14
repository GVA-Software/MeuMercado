import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produto, type Categoria, type Unidade } from '@meumercado/domain';
import { SEED_DATA } from '../../../data/data.module.js';
import type { SeedData } from '../../../data/seed.js';
import type { ProdutoRepository } from '../../../modules/catalog/produtos.repository.js';
import { combinaBusca } from '../../../common/texto.js';
import { ProdutoEntity } from '../entities/produto.entity.js';

/**
 * Catálogo persistente. Os itens básicos do seed servem de ponto de partida
 * (sempre presentes); os produtos criados pelos usuários ficam no Postgres.
 */
@Injectable()
export class TypeOrmProdutoRepository implements ProdutoRepository {
  private readonly seedProdutos: Produto[];
  private readonly seedIds: Set<string>;

  constructor(
    @InjectRepository(ProdutoEntity) private readonly repo: Repository<ProdutoEntity>,
    @Inject(SEED_DATA) seed: SeedData,
  ) {
    this.seedProdutos = seed.produtos;
    this.seedIds = new Set(seed.produtos.map((p) => p.id));
  }

  private toDomain(row: ProdutoEntity): Produto {
    return new Produto({
      id: row.id,
      nome: row.nome,
      categoria: row.categoria as Categoria,
      unidade: row.unidade as Unidade,
      ...(row.emoji !== null ? { emoji: row.emoji } : {}),
      ...(row.codigoExterno !== null ? { codigoExterno: row.codigoExterno } : {}),
      ...(row.ean !== null ? { ean: row.ean } : {}),
    });
  }

  async findAll(): Promise<Produto[]> {
    const rows = await this.repo.find();
    const doBanco = rows.filter((r) => !this.seedIds.has(r.id)).map((r) => this.toDomain(r));
    return [...this.seedProdutos, ...doBanco];
  }

  async findById(id: string): Promise<Produto | null> {
    const seedHit = this.seedProdutos.find((p) => p.id === id);
    if (seedHit) return seedHit;
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEan(ean: string): Promise<Produto | null> {
    const seedHit = this.seedProdutos.find((p) => p.ean === ean);
    if (seedHit) return seedHit;
    const row = await this.repo.findOne({ where: { ean } });
    return row ? this.toDomain(row) : null;
  }

  async search(termo: string, limit: number): Promise<Produto[]> {
    const todos = await this.findAll();
    return todos.filter((p) => combinaBusca(p.nome, termo)).slice(0, limit);
  }

  async add(produto: Produto): Promise<void> {
    await this.repo.insert({
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      unidade: produto.unidade,
      emoji: produto.emoji ?? null,
      codigoExterno: produto.codigoExterno ?? null,
      ean: produto.ean ?? null,
    });
  }

  async delete(id: string): Promise<void> {
    // Itens do seed são fixos (não estão no banco) — não há o que remover.
    if (this.seedIds.has(id)) return;
    await this.repo.delete(id);
  }
}
