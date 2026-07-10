import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Inscrição de Web Push persistida (um registro por endpoint/dispositivo). */
@Entity('push_subscriptions')
export class PushSubscriptionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  endpoint!: string;

  @Column()
  p256dh!: string;

  @Column()
  auth!: string;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
