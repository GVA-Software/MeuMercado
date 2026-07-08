import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { InsightsController } from './insights.controller.js';
import { InsightsService } from './insights.service.js';

@Module({
  // Importa para reusar PRODUTO_REPOSITORY e PRICE_OBSERVATION_REPOSITORY.
  imports: [CatalogModule, PricingModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
