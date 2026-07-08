import { Module } from '@nestjs/common';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

// CART_STORE é fornecido globalmente pelo PersistenceModule (memória ou Postgres).
@Module({
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
