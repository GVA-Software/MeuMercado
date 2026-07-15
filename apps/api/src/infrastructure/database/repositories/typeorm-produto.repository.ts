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

  /** Linha de banco que materializa um item de seed (para editá-lo ou ocultá-lo). */
  private materializar(
    p: Produto,
    hidden: boolean,
    nome?: string,
    categoria?: Categoria,
  ): Partial<ProdutoEntity> {
    return {
      id: p.id,
      nome: nome ?? p.nome,
      categoria: categoria ?? p.categoria,
      unidade: p.unidade,
      emoji: p.emoji ?? null,
      codigoExterno: p.codigoExterno ?? null,
      ean: p.ean ?? null,
      hidden,
    };
  }

  async findAll(): Promise<Produto[]> {
    const rows = await this.repo.find();
    const overrides = new Map<string, ProdutoEntity>();
    const doBanco: ProdutoEntity[] = [];
    for (const r of rows) {
      if (this.seedIds.has(r.id)) overrides.set(r.id, r);
      else if (!r.hidden) doBanco.push(r);
    }
    const seed = this.seedProdutos
      .map((p) => {
        const ov = overrides.get(p.id);
        if (!ov) return p; // seed intacto
        return ov.hidden ? null : this.toDomain(ov); // editado, ou ocultado (excluído)
      })
      .filter((p): p is Produto => p !== null);
    return [...seed, ...doBanco.map((r) => this.toDomain(r))];
  }

  async findById(id: string): Promise<Produto | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (row) return row.hidden ? null : this.toDomain(row);
    const seedHit = this.seedProdutos.find((p) => p.id === id);
    return seedHit ?? null;
  }

  async findByEan(ean: string): Promise<Produto | null> {
    const rows = await this.repo.find({ where: { ean } });
    const vivo = rows.find((r) => !r.hidden && !this.seedIds.has(r.id));
    if (vivo) return this.toDomain(vivo);
    const seedHit = this.seedProdutos.find((p) => p.ean === ean);
    if (!seedHit) return null;
    const ov = await this.repo.findOne({ where: { id: seedHit.id } });
    if (ov) return ov.hidden ? null : this.toDomain(ov);
    return seedHit;
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

  async atualizar(id: string, campos: { nome: string; categoria: Categoria }): Promise<boolean> {
    if (this.seedIds.has(id)) {
      // Materializa a edição do item de seed numa linha do banco (que passa a
      // sobrescrever o hardcoded no findAll).
      const seed = this.seedProdutos.find((p) => p.id === id);
      if (!seed) return false;
      const existe = await this.repo.findOne({ where: { id } });
      if (existe) {
        await this.repo.update({ id }, { nome: campos.nome, categoria: campos.categoria });
      } else {
        await this.repo.insert(this.materializar(seed, false, campos.nome, campos.categoria));
      }
      return true;
    }
    const r = await this.repo.update({ id }, { nome: campos.nome, categoria: campos.categoria });
    return (r.affected ?? 0) > 0;
  }

  async delete(id: string): Promise<void> {
    if (this.seedIds.has(id)) {
      // Não dá pra remover a linha hardcoded — grava/atualiza uma linha oculta.
      const existe = await this.repo.findOne({ where: { id } });
      if (existe) {
        await this.repo.update({ id }, { hidden: true });
      } else {
        const seed = this.seedProdutos.find((p) => p.id === id);
        if (seed) await this.repo.insert(this.materializar(seed, true));
      }
      return;
    }
    await this.repo.delete(id);
  }
}
