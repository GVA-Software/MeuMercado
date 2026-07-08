import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { InsightsController } from './insights.controller.js';
import { InsightsService } from './insights.service.js';

@Module({
  // CatalogModule → PRODUTO_REPOSITORY. PRICE_OBSERVATION_REPOSITORY e SEED_DATA
  // vêm globais (PersistenceModule / DataModule).
  imports: [CatalogModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
