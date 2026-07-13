import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PushModule } from '../push/push.module.js';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';

// AuthModule → JwtAuthGuard; PushModule → PushService; EmailModule é global.
// Os repositórios (feedback/user) vêm globais do PersistenceModule.
@Module({
  imports: [AuthModule, PushModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
