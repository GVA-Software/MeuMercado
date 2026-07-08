import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';

@Module({
  // AuthModule → JwtAuthGuard/TokenService (protege o POST); CatalogModule →
  // PRODUTO_REPOSITORY (para montar a tabela de preços). O repositório de
  // observações vem (global) do PersistenceModule — memória ou Postgres.
  imports: [AuthModule, CatalogModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
