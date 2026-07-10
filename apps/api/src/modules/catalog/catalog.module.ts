import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from '../admin/admin.guard.js';
import { ProdutosController } from './produtos.controller.js';
import { ProdutosService } from './produtos.service.js';

@Module({
  // AuthModule → JwtAuthGuard. AdminGuard (juntar produtos é só de ADM) só depende
  // do ConfigService (global). PRODUTO/PRICE_OBSERVATION vêm globais do PersistenceModule.
  imports: [AuthModule],
  controllers: [ProdutosController],
  providers: [ProdutosService, AdminGuard],
})
export class CatalogModule {}
