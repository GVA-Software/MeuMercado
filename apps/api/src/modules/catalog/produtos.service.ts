import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProdutoDTO } from '@meumercado/contracts';
import { PRODUTO_REPOSITORY, type ProdutoRepository } from './produtos.repository.js';

@Injectable()
export class ProdutosService {
  constructor(@Inject(PRODUTO_REPOSITORY) private readonly repo: ProdutoRepository) {}

  listar(): ProdutoDTO[] {
    return this.repo.findAll().map((p) => p.toJSON());
  }

  buscar(termo: string, limit: number): ProdutoDTO[] {
    return this.repo.search(termo, limit).map((p) => p.toJSON());
  }

  obter(id: string): ProdutoDTO {
    const produto = this.repo.findById(id);
    if (!produto) {
      throw new NotFoundException(`Produto não encontrado: ${id}`);
    }
    return produto.toJSON();
  }
}
