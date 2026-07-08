import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GeocodeModule } from '../geocode/geocode.module.js';
import { NfceController } from './nfce.controller.js';
import { NfceService } from './nfce.service.js';

@Module({
  // AuthModule → JwtAuthGuard; GeocodeModule → geocode do endereço. PRODUTO_ e
  // PRICE_OBSERVATION_REPOSITORY vêm globais (PersistenceModule).
  imports: [AuthModule, GeocodeModule],
  controllers: [NfceController],
  providers: [NfceService],
})
export class NfceModule {}
