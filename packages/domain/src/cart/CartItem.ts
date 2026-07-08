import { InvalidQuantityError } from '../errors.js';
import { Money, MoneyJSON } from '../money/Money.js';

export interface CartItemJSON {
  readonly lineId: string;
  readonly produtoId: string;
  readonly nome: string;
  readonly emoji?: string;
  readonly unitPrice: MoneyJSON;
  readonly quantity: number;
  readonly subtotal: MoneyJSON;
}

/**
 * Uma linha do carrinho: um produto, seu preço unitário e a quantidade.
 * Imutável — mudar a quantidade produz uma nova linha (`withQuantity`).
 */
export class CartItem {
  readonly lineId: string;
  readonly produtoId: string;
  readonly nome: string;
  readonly emoji: string | undefined;
  readonly unitPrice: Money;
  readonly quantity: number;

  constructor(params: {
    lineId: string;
    produtoId: string;
    nome: string;
    unitPrice: Money;
    quantity: number;
    emoji?: string;
  }) {
    if (!Number.isInteger(params.quantity) || params.quantity < 1) {
      throw new InvalidQuantityError(
        `Quantidade deve ser inteiro ≥ 1, recebido: ${params.quantity}`,
      );
    }
    this.lineId = params.lineId;
    this.produtoId = params.produtoId;
    this.nome = params.nome;
    this.unitPrice = params.unitPrice;
    this.quantity = params.quantity;
    this.emoji = params.emoji;
    Object.freeze(this);
  }

  subtotal(): Money {
    return this.unitPrice.multiply(this.quantity);
  }

  withQuantity(quantity: number): CartItem {
    return new CartItem({
      lineId: this.lineId,
      produtoId: this.produtoId,
      nome: this.nome,
      unitPrice: this.unitPrice,
      quantity,
      ...(this.emoji !== undefined ? { emoji: this.emoji } : {}),
    });
  }

  toJSON(): CartItemJSON {
    return {
      lineId: this.lineId,
      produtoId: this.produtoId,
      nome: this.nome,
      unitPrice: this.unitPrice.toJSON(),
      quantity: this.quantity,
      subtotal: this.subtotal().toJSON(),
      ...(this.emoji !== undefined ? { emoji: this.emoji } : {}),
    };
  }
}
