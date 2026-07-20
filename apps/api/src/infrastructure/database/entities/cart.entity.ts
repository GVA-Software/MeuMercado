import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('carts')
export class CartEntity {
  @PrimaryColumn('uuid')
  id!: string;

  /** Dono do carrinho (nullable: carrinhos antigos não tinham dono). */
  @Index()
  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId!: string | null;

  @Column({ name: 'limite_cents', type: 'int', nullable: true })
  limiteCents!: number | null;

  @Column({ name: 'mercado_id', type: 'varchar', nullable: true })
  mercadoId!: string | null;

  @Column({ name: 'mercado_nome', type: 'varchar', nullable: true })
  mercadoNome!: string | null;

  @Column({ name: 'mercado_endereco', type: 'varchar', nullable: true })
  mercadoEndereco!: string | null;

  @Column({ name: 'mercado_lat', type: 'double precision', nullable: true })
  mercadoLat!: number | null;

  @Column({ name: 'mercado_lng', type: 'double precision', nullable: true })
  mercadoLng!: number | null;
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

  /** null = item planejado (ainda sem preço na lista). */
  @Column({ name: 'unit_price_cents', type: 'int', nullable: true })
  unitPriceCents!: number | null;

  @Column({ type: 'int' })
  quantity!: number;

  /** Já riscado/comprado (com preço)? */
  @Column({ type: 'boolean', default: false })
  comprado!: boolean;
}
