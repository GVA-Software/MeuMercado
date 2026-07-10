import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { InsightsController } from './insights.controller.js';
import { InsightsService } from './insights.service.js';

@Module({
  // PRODUTO_REPOSITORY, PRICE_OBSERVATION_REPOSITORY e SEED_DATA vêm globais
  // (PersistenceModule / DataModule). AuthModule/BillingModule dão JwtAuthGuard/ProGuard.
  imports: [AuthModule, BillingModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
