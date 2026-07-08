import { Injectable } from '@nestjs/common';
import { Cart } from '@meumercado/domain';

/** Porta de armazenamento de carrinhos. Assíncrona (memória ou banco). */
export interface CartStore {
  get(id: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
}

export const CART_STORE = 'CART_STORE';

@Injectable()
export class InMemoryCartStore implements CartStore {
  private readonly carts = new Map<string, Cart>();

  get(id: string): Promise<Cart | null> {
    return Promise.resolve(this.carts.get(id) ?? null);
  }
  save(cart: Cart): Promise<void> {
    this.carts.set(cart.id, cart);
    return Promise.resolve();
  }
}
