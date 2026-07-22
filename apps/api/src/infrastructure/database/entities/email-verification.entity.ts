import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Pedido de confirmação de e-mail (guarda só o hash do token; expira e é uso único). */
@Entity('email_verifications')
export class EmailVerificationEntity {
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
