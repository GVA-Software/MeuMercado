import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { ComprasController } from './compras.controller.js';
import { ComprasService } from './compras.service.js';

// COMPRA_REPOSITORY vem global (PersistenceModule). AuthModule → guard;
// PricingModule → PricingService (economia).
@Module({
  imports: [AuthModule, PricingModule],
  controllers: [ComprasController],
  providers: [ComprasService],
  exports: [ComprasService],
})
export class ComprasModule {}
