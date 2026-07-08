import { describe, it, expect } from 'vitest';
import { Cart } from './Cart.js';
import { CartItem } from './CartItem.js';
import { Money } from '../money/Money.js';

const item = (lineId: string, reais: number, qty: number): CartItem =>
  new CartItem({
    lineId,
    produtoId: `p-${lineId}`,
    nome: `Produto ${lineId}`,
    unitPrice: Money.fromReais(reais),
    quantity: qty,
  });

describe('Cart', () => {
  it('soma subtotais corretamente (sem erro de float)', () => {
    const cart = new Cart({ id: 'c1' });
    cart.addItem(item('a', 6.2, 4)); // 24,80
    cart.addItem(item('b', 8.5, 2)); // 17,00
    expect(cart.total().cents).toBe(4180);
    expect(cart.total().format()).toMatch(/^R\$\s?41,80$/);
  });

  it('carrinho vazio vale R$ 0,00 e status sem-limite', () => {
    const cart = new Cart({ id: 'c1' });
    expect(cart.total().isZero()).toBe(true);
    expect(cart.status()).toBe('sem-limite');
    expect(cart.progressPercent()).toBeNull();
  });

  it('progride e dispara alerta em 80% e estouro em 100%', () => {
    const cart = new Cart({ id: 'c1', limite: Money.fromReais(100) });
    cart.addItem(item('a', 50, 1));
    expect(cart.status()).toBe('ok');
    cart.setQuantity('a', 1);
    cart.addItem(item('b', 35, 1)); // total 85 → 85%
    expect(cart.status()).toBe('alerta');
    cart.addItem(item('c', 20, 1)); // total 105 → estourado
    expect(cart.status()).toBe('estourado');
    expect(cart.remaining()!.isNegative()).toBe(true);
    expect(cart.remaining()!.abs().cents).toBe(500);
  });

  it('impede linha duplicada e valida quantidade', () => {
    const cart = new Cart({ id: 'c1' });
    cart.addItem(item('a', 10, 1));
    expect(() => cart.addItem(item('a', 10, 1))).toThrow();
    expect(() => item('x', 10, 0)).toThrow();
  });

  it('remove item e recalcula', () => {
    const cart = new Cart({ id: 'c1' });
    cart.addItem(item('a', 10, 1));
    cart.addItem(item('b', 20, 1));
    cart.removeItem('a');
    expect(cart.itemCount).toBe(1);
    expect(cart.total().cents).toBe(2000);
  });
});
