import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('subscriptions')
export class SubscriptionEntity {
  @PrimaryColumn('uuid', { name: 'usuario_id' })
  usuarioId!: string;

  @Column()
  plano!: string;

  @Column({ type: 'varchar', nullable: true })
  periodo!: string | null;

  @Column()
  status!: string;

  @Column({ name: 'trial_fim', type: 'timestamptz', nullable: true })
  trialFim!: Date | null;

  @Column({ name: 'periodo_fim', type: 'timestamptz', nullable: true })
  periodoFim!: Date | null;
}
