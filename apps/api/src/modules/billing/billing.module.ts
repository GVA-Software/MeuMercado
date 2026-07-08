import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { ProGuard } from './pro.guard.js';
import {
  InMemorySubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from './subscription.repository.js';

@Module({
  imports: [AuthModule], // usa JwtAuthGuard nas rotas
  controllers: [BillingController],
  providers: [
    BillingService,
    ProGuard,
    { provide: SUBSCRIPTION_REPOSITORY, useClass: InMemorySubscriptionRepository },
  ],
  exports: [BillingService], // outros módulos podem gatilhar features Pro
})
export class BillingModule {}
