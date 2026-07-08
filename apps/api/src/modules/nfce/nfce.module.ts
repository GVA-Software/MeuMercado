import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NfceController } from './nfce.controller.js';
import { NfceService } from './nfce.service.js';

@Module({
  // AuthModule → JwtAuthGuard. PRODUTO_REPOSITORY e PRICE_OBSERVATION_REPOSITORY
  // vêm globais (PersistenceModule).
  imports: [AuthModule],
  controllers: [NfceController],
  providers: [NfceService],
})
export class NfceModule {}
