import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem, Money } from '@meumercado/domain';
import type { CartStore } from '../../../modules/cart/cart.store.js';
import { CartEntity, CartItemEntity } from '../entities/cart.entity.js';

@Injectable()
export class TypeOrmCartRepository implements CartStore {
  constructor(
    @InjectRepository(CartEntity) private readonly carts: Repository<CartEntity>,
    @InjectRepository(CartItemEntity) private readonly items: Repository<CartItemEntity>,
  ) {}

  async get(id: string): Promise<Cart | null> {
    const c = await this.carts.findOne({ where: { id } });
    if (!c) return null;
    const rows = await this.items.find({ where: { cartId: id } });
    const items = rows.map(
      (i) =>
        new CartItem({
          lineId: i.lineId,
          produtoId: i.produtoId,
          nome: i.nome,
          unitPrice: Money.fromCents(i.unitPriceCents),
          quantity: i.quantity,
          ...(i.emoji !== null ? { emoji: i.emoji } : {}),
        }),
    );
    return new Cart({
      id: c.id,
      limite: c.limiteCents !== null ? Money.fromCents(c.limiteCents) : null,
      items,
    });
  }

  async save(cart: Cart): Promise<void> {
    await this.carts.save({ id: cart.id, limiteCents: cart.limite?.cents ?? null });
    // Substitui as linhas (aggregate salvo por completo).
    await this.items.delete({ cartId: cart.id });
    const rows = cart.items.map((i) => ({
      lineId: i.lineId,
      cartId: cart.id,
      produtoId: i.produtoId,
      nome: i.nome,
      emoji: i.emoji ?? null,
      unitPriceCents: i.unitPrice.cents,
      quantity: i.quantity,
    }));
    if (rows.length > 0) await this.items.insert(rows);
  }
}
