import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

// CART_STORE é fornecido globalmente pelo PersistenceModule (memória ou Postgres).
// AuthModule → JwtAuthGuard; PricingModule → PricingService (auto-report do preço).
@Module({
  imports: [AuthModule, PricingModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
