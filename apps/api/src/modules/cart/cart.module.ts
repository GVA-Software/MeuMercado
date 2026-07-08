import { Module } from '@nestjs/common';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { CartStore } from './cart.store.js';

@Module({
  controllers: [CartController],
  providers: [CartService, CartStore],
})
export class CartModule {}
