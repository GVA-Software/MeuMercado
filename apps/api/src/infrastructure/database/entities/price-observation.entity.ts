import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Observação de preço reportada por um usuário — o dado colaborativo bruto que
 * alimenta a tabela de preços e a Nina. Imutável (nunca atualizamos, só inserimos).
 */
@Entity('price_observations')
export class PriceObservationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'produto_id' })
  produtoId!: string;

  @Column({ name: 'mercado_id' })
  mercadoId!: string;

  @Column({ name: 'mercado_nome', type: 'varchar', nullable: true })
  mercadoNome!: string | null;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents!: number;

  @Column()
  source!: string;

  @Index()
  @Column({ name: 'reporter_id' })
  reporterId!: string;

  @Column({ name: 'observed_at', type: 'timestamptz' })
  observedAt!: Date;
}
