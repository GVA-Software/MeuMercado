import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('carts')
export class CartEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'limite_cents', type: 'int', nullable: true })
  limiteCents!: number | null;
}

@Entity('cart_items')
export class CartItemEntity {
  @PrimaryColumn('uuid', { name: 'line_id' })
  lineId!: string;

  @Index()
  @Column({ name: 'cart_id' })
  cartId!: string;

  @Column({ name: 'produto_id' })
  produtoId!: string;

  @Column()
  nome!: string;

  @Column({ type: 'varchar', nullable: true })
  emoji!: string | null;

  @Column({ name: 'unit_price_cents', type: 'int' })
  unitPriceCents!: number;

  @Column({ type: 'int' })
  quantity!: number;
}
