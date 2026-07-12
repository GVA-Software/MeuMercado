import { Module } from '@nestjs/common';
import { PushModule } from '../modules/push/push.module.js';
import { QaCronController } from './qa-cron.controller.js';

// PushModule → PushService. Repositórios (produtos/preços/usuários) são globais.
@Module({
  imports: [PushModule],
  controllers: [QaCronController],
})
export class QaModule {}
