import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProdutosController } from './produtos.controller.js';
import { ProdutosService } from './produtos.service.js';

@Module({
  // AuthModule → JwtAuthGuard (protege a criação de produto). O PRODUTO_REPOSITORY
  // vem (global) do PersistenceModule — memória ou Postgres.
  imports: [AuthModule],
  controllers: [ProdutosController],
  providers: [ProdutosService],
})
export class CatalogModule {}
