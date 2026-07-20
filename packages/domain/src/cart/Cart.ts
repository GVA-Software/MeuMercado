import { InvalidCartError } from '../errors.js';
import { Money } from '../money/Money.js';
import { CartItem } from './CartItem.js';

/** Situação do carrinho em relação ao limite de orçamento. */
export type BudgetStatus = 'sem-limite' | 'ok' | 'alerta' | 'estourado';

/** Mercado onde a compra está sendo feita (confirmado pela localização do usuário). */
export interface CartMercado {
  readonly id: string;
  readonly nome: string;
  readonly endereco?: string;
  readonly lat?: number;
  readonly lng?: number;
}

/** Percentuais de gatilho (espelham a UI do protótipo). */
const WARN_AT = 80;
const OVER_AT = 100;

/**
 * Carrinho de compras — aggregate root. Encapsula os itens e a regra de
 * orçamento (limite) que dispara os avisos "80% do limite" / "limite
 * ultrapassado". Mutável de forma controlada: só muda por métodos que preservam
 * as invariantes (sem linhas duplicadas, quantidades válidas).
 */
export class Cart {
  readonly id: string;
  /** Dono do carrinho — usado para escopar o acesso ao usuário autenticado. */
  readonly userId?: string;
  private readonly _items: Map<string, CartItem>;
  private _limite: Money | null;
  private _mercado: CartMercado | null;

  constructor(params: {
    id: string;
    userId?: string;
    limite?: Money | null;
    items?: readonly CartItem[];
    mercado?: CartMercado | null;
  }) {
    this.id = params.id;
    if (params.userId !== undefined) this.userId = params.userId;
    this._limite = params.limite ?? null;
    this._mercado = params.mercado ?? null;
    this._items = new Map();
    for (const item of params.items ?? []) {
      this._items.set(item.lineId, item);
    }
  }

  get items(): readonly CartItem[] {
    return [...this._items.values()];
  }

  get limite(): Money | null {
    return this._limite;
  }

  get mercado(): CartMercado | null {
    return this._mercado;
  }

  setMercado(mercado: CartMercado | null): void {
    this._mercado = mercado;
  }

  get isEmpty(): boolean {
    return this._items.size === 0;
  }

  get itemCount(): number {
    return this._items.size;
  }

  setLimite(limite: Money | null): void {
    if (limite !== null && limite.isNegative()) {
      throw new InvalidCartError('Limite não pode ser negativo');
    }
    this._limite = limite;
  }

  addItem(item: CartItem): void {
    if (this._items.has(item.lineId)) {
      throw new InvalidCartError(`Linha já existe no carrinho: ${item.lineId}`);
    }
    this._items.set(item.lineId, item);
  }

  removeItem(lineId: string): void {
    this._items.delete(lineId);
  }

  setQuantity(lineId: string, quantity: number): void {
    const item = this._items.get(lineId);
    if (!item) {
      throw new InvalidCartError(`Linha não encontrada: ${lineId}`);
    }
    this._items.set(lineId, item.withQuantity(quantity));
  }

  /** Risca um item da lista: grava preço + quantidade e marca como comprado. */
  marcarComprado(lineId: string, unitPrice: Money, quantity: number): void {
    const item = this._items.get(lineId);
    if (!item) throw new InvalidCartError(`Linha não encontrada: ${lineId}`);
    this._items.set(lineId, item.marcarComprado(unitPrice, quantity));
  }

  /** Desmarca um item (volta a planejado). */
  desmarcar(lineId: string): void {
    const item = this._items.get(lineId);
    if (!item) throw new InvalidCartError(`Linha não encontrada: ${lineId}`);
    this._items.set(lineId, item.desmarcar());
  }

  /** Itens já comprados (riscados com preço) — o que vira Compra no fim. */
  get comprados(): readonly CartItem[] {
    return [...this._items.values()].filter((i) => i.comprado);
  }

  /** Soma dos subtotais. Carrinho vazio → R$ 0,00. */
  total(): Money {
    let total = Money.zero();
    for (const item of this._items.values()) {
      total = total.add(item.subtotal());
    }
    return total;
  }

  /** Quanto falta para o limite (negativo se estourou). `null` sem limite. */
  remaining(): Money | null {
    if (this._limite === null) return null;
    return this._limite.subtract(this.total());
  }

  /** Percentual do limite já usado (pode passar de 100). `null` sem limite. */
  progressPercent(): number | null {
    if (this._limite === null || this._limite.isZero()) return null;
    return (this.total().cents / this._limite.cents) * 100;
  }

  status(): BudgetStatus {
    const pct = this.progressPercent();
    if (pct === null) return 'sem-limite';
    if (pct >= OVER_AT) return 'estourado';
    if (pct >= WARN_AT) return 'alerta';
    return 'ok';
  }
}
