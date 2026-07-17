import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Observação de preço reportada por um usuário — o dado colaborativo bruto que
 * alimenta a tabela de preços e a Nina. Imutável (nunca atualizamos, só inserimos).
 */
@Entity('price_observations')
export class PriceObservationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  /**
   * Carimbo IMUTÁVEL do SERVIDOR no momento da inserção (art. 15 do Marco Civil).
   * Diferente de `observed_at`, que é a data INFORMADA pelo cliente e pode ser
   * manipulada — este é a hora real em que o preço entrou na base.
   */
  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @Index()
  @Column({ name: 'produto_id' })
  produtoId!: string;

  @Column({ name: 'mercado_id' })
  mercadoId!: string;

  @Column({ name: 'mercado_nome', type: 'varchar', nullable: true })
  mercadoNome!: string | null;

  @Column({ name: 'mercado_endereco', type: 'varchar', nullable: true })
  mercadoEndereco!: string | null;

  @Column({ name: 'mercado_lat', type: 'double precision', nullable: true })
  mercadoLat!: number | null;

  @Column({ name: 'mercado_lng', type: 'double precision', nullable: true })
  mercadoLng!: number | null;

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
