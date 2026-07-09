import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { CompraItemDTO } from '@meumercado/contracts';

/** Compra finalizada (snapshot) — histórico pessoal de gastos. */
@Entity('compras')
export class CompraEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'mercado_id', type: 'varchar', nullable: true })
  mercadoId!: string | null;

  @Column({ name: 'mercado_nome', type: 'varchar', nullable: true })
  mercadoNome!: string | null;

  @Column({ name: 'mercado_endereco', type: 'varchar', nullable: true })
  mercadoEndereco!: string | null;

  @Column({ name: 'total_cents', type: 'int' })
  totalCents!: number;

  @Column({ name: 'economia_cents', type: 'int', default: 0 })
  economiaCents!: number;

  @Column({ type: 'jsonb' })
  itens!: CompraItemDTO[];

  @Column({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;
}
