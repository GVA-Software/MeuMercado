import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Produto } from '@meumercado/domain';
import type { CreateProdutoInput, ProdutoDTO } from '@meumercado/contracts';
import { PRODUTO_REPOSITORY, type ProdutoRepository } from './produtos.repository.js';

@Injectable()
export class ProdutosService {
  constructor(@Inject(PRODUTO_REPOSITORY) private readonly repo: ProdutoRepository) {}

  async listar(): Promise<ProdutoDTO[]> {
    return (await this.repo.findAll()).map((p) => p.toJSON());
  }

  async buscar(termo: string, limit: number): Promise<ProdutoDTO[]> {
    return (await this.repo.search(termo, limit)).map((p) => p.toJSON());
  }

  async obter(id: string): Promise<ProdutoDTO> {
    const produto = await this.repo.findById(id);
    if (!produto) {
      throw new NotFoundException(`Produto não encontrado: ${id}`);
    }
    return produto.toJSON();
  }

  /** Cria um produto no catálogo (aberto — alimentado pelos usuários). */
  async criar(input: CreateProdutoInput): Promise<ProdutoDTO> {
    const produto = new Produto({
      id: randomUUID(),
      nome: input.nome,
      categoria: input.categoria ?? 'Outros',
      unidade: input.unidade ?? 'un',
      ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
    });
    await this.repo.add(produto);
    return produto.toJSON();
  }
}
