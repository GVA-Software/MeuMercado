import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import {
  InMemoryPriceObservationRepository,
  PRICE_OBSERVATION_REPOSITORY,
} from './price-observation.repository.js';

@Module({
  // AuthModule → JwtAuthGuard/TokenService (protege o POST); CatalogModule →
  // PRODUTO_REPOSITORY (para montar a tabela de preços).
  imports: [AuthModule, CatalogModule],
  controllers: [PricingController],
  providers: [
    PricingService,
    { provide: PRICE_OBSERVATION_REPOSITORY, useClass: InMemoryPriceObservationRepository },
  ],
  exports: [PricingService, PRICE_OBSERVATION_REPOSITORY],
})
export class PricingModule {}
