import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cart, CartItem, Money } from '@meumercado/domain';
import type { AddCartItemInput, CartDTO } from '@meumercado/contracts';
import { CART_STORE, type CartStore } from './cart.store.js';

@Injectable()
export class CartService {
  constructor(@Inject(CART_STORE) private readonly store: CartStore) {}

  async criar(): Promise<CartDTO> {
    const cart = new Cart({ id: randomUUID() });
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async obter(id: string): Promise<CartDTO> {
    return this.toDTO(await this.requireCart(id));
  }

  async adicionarItem(id: string, input: AddCartItemInput): Promise<CartDTO> {
    const cart = await this.requireCart(id);
    cart.addItem(
      new CartItem({
        lineId: randomUUID(),
        produtoId: input.produtoId,
        nome: input.nome,
        unitPrice: Money.fromCents(input.unitPriceCents),
        quantity: input.quantity,
        ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      }),
    );
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async alterarQuantidade(id: string, lineId: string, quantity: number): Promise<CartDTO> {
    const cart = await this.requireCart(id);
    cart.setQuantity(lineId, quantity);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async removerItem(id: string, lineId: string): Promise<CartDTO> {
    const cart = await this.requireCart(id);
    cart.removeItem(lineId);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async definirLimite(id: string, limiteCents: number | null): Promise<CartDTO> {
    const cart = await this.requireCart(id);
    cart.setLimite(limiteCents === null ? null : Money.fromCents(limiteCents));
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  private async requireCart(id: string): Promise<Cart> {
    const cart = await this.store.get(id);
    if (!cart) {
      throw new NotFoundException(`Carrinho não encontrado: ${id}`);
    }
    return cart;
  }

  private toDTO(cart: Cart): CartDTO {
    return {
      id: cart.id,
      items: cart.items.map((i) => i.toJSON()),
      total: cart.total().toJSON(),
      limite: cart.limite?.toJSON() ?? null,
      remaining: cart.remaining()?.toJSON() ?? null,
      progressPercent: cart.progressPercent(),
      status: cart.status(),
    };
  }
}
