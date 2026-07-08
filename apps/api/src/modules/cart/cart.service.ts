import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Cart, CartItem, Money } from '@meumercado/domain';
import type { AddCartItemInput, CartDTO } from '@meumercado/contracts';
import { CartStore } from './cart.store.js';

@Injectable()
export class CartService {
  constructor(private readonly store: CartStore) {}

  criar(): CartDTO {
    const cart = new Cart({ id: randomUUID() });
    this.store.save(cart);
    return this.toDTO(cart);
  }

  obter(id: string): CartDTO {
    return this.toDTO(this.requireCart(id));
  }

  adicionarItem(id: string, input: AddCartItemInput): CartDTO {
    const cart = this.requireCart(id);
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
    this.store.save(cart);
    return this.toDTO(cart);
  }

  alterarQuantidade(id: string, lineId: string, quantity: number): CartDTO {
    const cart = this.requireCart(id);
    cart.setQuantity(lineId, quantity);
    this.store.save(cart);
    return this.toDTO(cart);
  }

  removerItem(id: string, lineId: string): CartDTO {
    const cart = this.requireCart(id);
    cart.removeItem(lineId);
    this.store.save(cart);
    return this.toDTO(cart);
  }

  definirLimite(id: string, limiteCents: number | null): CartDTO {
    const cart = this.requireCart(id);
    cart.setLimite(limiteCents === null ? null : Money.fromCents(limiteCents));
    this.store.save(cart);
    return this.toDTO(cart);
  }

  private requireCart(id: string): Cart {
    const cart = this.store.get(id);
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
