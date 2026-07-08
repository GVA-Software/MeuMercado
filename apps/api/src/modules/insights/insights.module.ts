import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller.js';
import { InsightsService } from './insights.service.js';

@Module({
  // PRODUTO_REPOSITORY, PRICE_OBSERVATION_REPOSITORY e SEED_DATA vêm globais
  // (PersistenceModule / DataModule).
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
