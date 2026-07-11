import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Evento de analytics (self-hosted). Append-only — só inserimos. Alimenta o
 * funil de ativação no painel de ADM, sem depender de serviço externo.
 */
@Entity('analytics_events')
export class AnalyticsEventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column()
  name!: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  props!: Record<string, string | number | boolean> | null;

  @Index()
  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
