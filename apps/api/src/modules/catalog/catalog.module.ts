import { Module } from '@nestjs/common';
import { ProdutosController } from './produtos.controller.js';
import { ProdutosService } from './produtos.service.js';
import { InMemoryProdutoRepository, PRODUTO_REPOSITORY } from './produtos.repository.js';

@Module({
  controllers: [ProdutosController],
  providers: [
    ProdutosService,
    { provide: PRODUTO_REPOSITORY, useClass: InMemoryProdutoRepository },
  ],
  exports: [PRODUTO_REPOSITORY],
})
export class CatalogModule {}
