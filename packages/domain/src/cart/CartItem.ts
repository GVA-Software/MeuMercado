import { InvalidQuantityError } from '../errors.js';
import { Money, MoneyJSON } from '../money/Money.js';

export interface CartItemJSON {
  readonly lineId: string;
  readonly produtoId: string;
  readonly nome: string;
  readonly emoji?: string;
  /** Preço unitário pago — `null` enquanto o item é só um PLANEJADO da lista. */
  readonly unitPrice: MoneyJSON | null;
  readonly quantity: number;
  /** Já foi comprado (riscado da lista com preço)? */
  readonly comprado: boolean;
  readonly subtotal: MoneyJSON;
}

/**
 * Uma linha da lista/carrinho: um produto e a quantidade pretendida. Começa
 * PLANEJADA (sem preço, `comprado=false`) — a lista de papel digital. Ao riscar,
 * vira COMPRADA com `unitPrice` (é aí que o preço entra na base). Imutável.
 */
export class CartItem {
  readonly lineId: string;
  readonly produtoId: string;
  readonly nome: string;
  readonly emoji: string | undefined;
  readonly unitPrice: Money | null;
  readonly quantity: number;
  readonly comprado: boolean;

  constructor(params: {
    lineId: string;
    produtoId: string;
    nome: string;
    quantity: number;
    unitPrice?: Money | null;
    comprado?: boolean;
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
    this.unitPrice = params.unitPrice ?? null;
    this.quantity = params.quantity;
    this.comprado = params.comprado ?? false;
    this.emoji = params.emoji;
    Object.freeze(this);
  }

  /** Só o item COMPRADO com preço soma no total; planejado é R$ 0,00. */
  subtotal(): Money {
    return this.comprado && this.unitPrice ? this.unitPrice.multiply(this.quantity) : Money.zero();
  }

  /** Risca o item: grava preço + quantidade e marca como comprado. */
  marcarComprado(unitPrice: Money, quantity: number): CartItem {
    return new CartItem({
      lineId: this.lineId,
      produtoId: this.produtoId,
      nome: this.nome,
      unitPrice,
      quantity,
      comprado: true,
      ...(this.emoji !== undefined ? { emoji: this.emoji } : {}),
    });
  }

  /** Desmarca (volta a planejado) — mantém o preço digitado pra facilitar re-riscar. */
  desmarcar(): CartItem {
    return new CartItem({
      lineId: this.lineId,
      produtoId: this.produtoId,
      nome: this.nome,
      quantity: this.quantity,
      comprado: false,
      ...(this.unitPrice !== null ? { unitPrice: this.unitPrice } : {}),
      ...(this.emoji !== undefined ? { emoji: this.emoji } : {}),
    });
  }

  withQuantity(quantity: number): CartItem {
    return new CartItem({
      lineId: this.lineId,
      produtoId: this.produtoId,
      nome: this.nome,
      quantity,
      comprado: this.comprado,
      ...(this.unitPrice !== null ? { unitPrice: this.unitPrice } : {}),
      ...(this.emoji !== undefined ? { emoji: this.emoji } : {}),
    });
  }

  toJSON(): CartItemJSON {
    return {
      lineId: this.lineId,
      produtoId: this.produtoId,
      nome: this.nome,
      unitPrice: this.unitPrice?.toJSON() ?? null,
      quantity: this.quantity,
      comprado: this.comprado,
      subtotal: this.subtotal().toJSON(),
      ...(this.emoji !== undefined ? { emoji: this.emoji } : {}),
    };
  }
}
