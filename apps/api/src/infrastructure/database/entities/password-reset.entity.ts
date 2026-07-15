import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Pedido de recuperação de senha (guarda só o hash do token; expira e é uso único). */
@Entity('password_resets')
export class PasswordResetEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'token_hash' })
  tokenHash!: string;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm!: Date;

  @Column({ type: 'boolean', default: false })
  usado!: boolean;
}
