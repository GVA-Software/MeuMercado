import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Feedback enviado por um usuário (bug/sugestão/elogio) e a resposta do ADM. */
@Entity('feedbacks')
export class FeedbackEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'usuario_id' })
  usuarioId!: string;

  @Column({ name: 'usuario_nome' })
  usuarioNome!: string;

  @Column({ name: 'usuario_email' })
  usuarioEmail!: string;

  @Column()
  tipo!: string;

  @Column({ type: 'text' })
  mensagem!: string;

  @Index()
  @Column()
  status!: string;

  @Column({ type: 'text', nullable: true })
  resposta!: string | null;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @Column({ name: 'respondido_em', type: 'timestamptz', nullable: true })
  respondidoEm!: Date | null;
}
