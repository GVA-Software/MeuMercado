import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ComprasModule } from '../compras/compras.module.js';
import { ListasModule } from '../listas/listas.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

// CART_STORE é global (PersistenceModule). AuthModule → guard; PricingModule →
// auto-report; ComprasModule → finalizar a compra no histórico; ListasModule →
// "usar lista salva" semeia o carrinho.
@Module({
  imports: [AuthModule, PricingModule, ComprasModule, ListasModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
