import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';

@Module({
  // AuthModule → JwtAuthGuard/TokenService (protege o POST). Os repositórios de
  // observações e de produtos vêm (globais) do PersistenceModule.
  imports: [AuthModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
