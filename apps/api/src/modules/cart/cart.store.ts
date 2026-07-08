import { Injectable } from '@nestjs/common';
import { Cart } from '@meumercado/domain';

/**
 * Armazenamento em memória de carrinhos (por sessão/usuário). Substituível por
 * Redis/Postgres depois — o service não muda.
 */
@Injectable()
export class CartStore {
  private readonly carts = new Map<string, Cart>();

  save(cart: Cart): void {
    this.carts.set(cart.id, cart);
  }

  get(id: string): Cart | null {
    return this.carts.get(id) ?? null;
  }
}
