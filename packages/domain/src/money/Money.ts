import { CurrencyMismatchError, InvalidMoneyError } from '../errors.js';

/** Moedas suportadas. O app é Brasil-first, mas o value object já é preparado. */
export type Currency = 'BRL';

export interface MoneyJSON {
  readonly cents: number;
  readonly currency: Currency;
}

/**
 * Valor monetário imutável armazenado em **centavos inteiros** — NUNCA em `float`.
 *
 * Motivo: `0.1 + 0.2 !== 0.3` em ponto flutuante. Num app cujo propósito é
 * economizar dinheiro, somar preços em `float` acumula erro de centavos. Toda a
 * aritmética aqui é feita em inteiros e só formatamos para reais na borda (UI).
 */
export class Money {
  private readonly _cents: number;
  private readonly _currency: Currency;

  private constructor(cents: number, currency: Currency) {
    if (!Number.isInteger(cents)) {
      throw new InvalidMoneyError(`Centavos devem ser inteiros, recebido: ${cents}`);
    }
    if (!Number.isSafeInteger(cents)) {
      throw new InvalidMoneyError('Valor monetário fora do intervalo seguro');
    }
    this._cents = cents;
    this._currency = currency;
    Object.freeze(this);
  }

  static fromCents(cents: number, currency: Currency = 'BRL'): Money {
    return new Money(cents, currency);
  }

  /** A partir de reais (ex.: 28.90). Arredonda para o centavo mais próximo. */
  static fromReais(reais: number, currency: Currency = 'BRL'): Money {
    if (!Number.isFinite(reais)) {
      throw new InvalidMoneyError(`Valor inválido em reais: ${reais}`);
    }
    return new Money(Math.round(reais * 100), currency);
  }

  static zero(currency: Currency = 'BRL'): Money {
    return new Money(0, currency);
  }

  static from(json: MoneyJSON): Money {
    return new Money(json.cents, json.currency);
  }

  get cents(): number {
    return this._cents;
  }

  get currency(): Currency {
    return this._currency;
  }

  /** Valor em reais como número (use só para exibição/serialização leve). */
  get reais(): number {
    return this._cents / 100;
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new CurrencyMismatchError(this._currency, other._currency);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._cents + other._cents, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._cents - other._cents, this._currency);
  }

  /** Multiplica por uma quantidade (ex.: preço unitário × qtd). Arredonda. */
  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new InvalidMoneyError(`Fator inválido: ${factor}`);
    }
    return new Money(Math.round(this._cents * factor), this._currency);
  }

  abs(): Money {
    return new Money(Math.abs(this._cents), this._currency);
  }

  isZero(): boolean {
    return this._cents === 0;
  }

  isNegative(): boolean {
    return this._cents < 0;
  }

  equals(other: Money): boolean {
    return this._cents === other._cents && this._currency === other._currency;
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._cents > other._cents;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._cents < other._cents;
  }

  /**
   * Variação percentual em relação a uma base (ex.: preço atual vs média).
   * Positivo = mais caro; negativo = mais barato. Base zero → 0.
   */
  percentageDiffFrom(base: Money): number {
    this.assertSameCurrency(base);
    if (base._cents === 0) return 0;
    return ((this._cents - base._cents) / base._cents) * 100;
  }

  /** Formata em pt-BR: "R$ 28,90". */
  format(): string {
    return (this._cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: this._currency,
    });
  }

  toJSON(): MoneyJSON {
    return { cents: this._cents, currency: this._currency };
  }
}
