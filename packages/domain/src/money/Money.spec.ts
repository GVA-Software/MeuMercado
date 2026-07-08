import { describe, it, expect } from 'vitest';
import { Money } from './Money.js';
import { CurrencyMismatchError, InvalidMoneyError } from '../errors.js';

describe('Money', () => {
  it('não sofre o erro clássico de float (0,1 + 0,2 = 0,3)', () => {
    const soma = Money.fromReais(0.1).add(Money.fromReais(0.2));
    expect(soma.cents).toBe(30);
    expect(soma.equals(Money.fromReais(0.3))).toBe(true);
  });

  it('fromReais arredonda para o centavo mais próximo', () => {
    expect(Money.fromReais(28.9).cents).toBe(2890);
    expect(Money.fromReais(7.905).cents).toBe(791);
  });

  it('rejeita centavos não inteiros', () => {
    expect(() => Money.fromCents(10.5)).toThrow(InvalidMoneyError);
  });

  it('soma preço × quantidade sem perder centavos', () => {
    const total = Money.fromReais(6.2).multiply(4);
    expect(total.cents).toBe(2480);
    expect(total.format()).toMatch('R$ 24,80');
  });

  it('subtrai e detecta negativo (estouro de limite)', () => {
    const restante = Money.fromReais(150).subtract(Money.fromReais(168.5));
    expect(restante.isNegative()).toBe(true);
    expect(restante.abs().cents).toBe(1850);
  });

  it('calcula variação percentual vs média', () => {
    // café subiu de 12,90 para 14,90 ≈ +15,5%
    const pct = Money.fromReais(14.9).percentageDiffFrom(Money.fromReais(12.9));
    expect(pct).toBeGreaterThan(15);
    expect(pct).toBeLessThan(16);
  });

  it('impede operar moedas diferentes', () => {
    const brl = Money.fromCents(100, 'BRL');
    const outra = Money.fromCents(100, 'USD' as unknown as 'BRL');
    expect(() => brl.add(outra)).toThrow(CurrencyMismatchError);
  });

  it('serializa e reidrata via JSON', () => {
    const m = Money.fromReais(28.9);
    expect(Money.from(m.toJSON()).equals(m)).toBe(true);
  });
});
