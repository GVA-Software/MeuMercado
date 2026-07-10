import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PushController } from './push.controller.js';
import { PushService } from './push.service.js';

// PUSH_SUBSCRIPTION_REPOSITORY é global (PersistenceModule).
@Module({
  imports: [AuthModule], // JwtAuthGuard nas rotas
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService], // AdminModule usa para felicitar ao conceder Pro
})
export class PushModule {}
