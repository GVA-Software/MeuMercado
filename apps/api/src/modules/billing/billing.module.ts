import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { ProGuard } from './pro.guard.js';

// SUBSCRIPTION_REPOSITORY é fornecido globalmente pelo PersistenceModule.
@Module({
  imports: [AuthModule], // usa JwtAuthGuard nas rotas
  controllers: [BillingController],
  providers: [BillingService, ProGuard],
  exports: [BillingService], // outros módulos podem gatilhar features Pro
})
export class BillingModule {}
