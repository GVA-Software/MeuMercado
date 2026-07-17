import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Registro de acesso (write) — art. 15 do Marco Civil. Append-only: só inserimos.
 * Retido ≥6 meses para permitir identificar o autor de um conteúdo sob ordem judicial.
 */
@Entity('access_logs')
export class AccessLogEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column()
  method!: string;

  @Column()
  path!: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', nullable: true })
  userAgent!: string | null;

  @Index()
  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
