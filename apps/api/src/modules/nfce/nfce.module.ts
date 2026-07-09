import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GeocodeModule } from '../geocode/geocode.module.js';
import { ComprasModule } from '../compras/compras.module.js';
import { NfceController } from './nfce.controller.js';
import { NfceService } from './nfce.service.js';

@Module({
  // AuthModule → JwtAuthGuard; GeocodeModule → geocode; ComprasModule → registrar
  // a nota como compra no histórico. PRODUTO_/PRICE_OBSERVATION_REPOSITORY globais.
  imports: [AuthModule, GeocodeModule, ComprasModule],
  controllers: [NfceController],
  providers: [NfceService],
})
export class NfceModule {}
