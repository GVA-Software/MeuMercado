import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Sessão de refresh (rotação + revogação). O refresh JWT carrega o `jti`. */
@Entity('refresh_sessions')
export class RefreshSessionEntity {
  @PrimaryColumn('uuid')
  jti!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'replaced_by_jti', type: 'uuid', nullable: true })
  replacedByJti!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
