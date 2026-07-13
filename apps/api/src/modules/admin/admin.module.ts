import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { PushModule } from '../push/push.module.js';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

// USER_REPOSITORY é global. BillingModule → BillingService; PushModule → PushService;
// FeedbackModule → FeedbackService (rotas de feedback do painel).
@Module({
  imports: [AuthModule, BillingModule, PushModule, FeedbackModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
