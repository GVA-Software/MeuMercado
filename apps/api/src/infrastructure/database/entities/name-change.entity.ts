import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Trilha de auditoria das alterações de nome do usuário. */
@Entity('name_changes')
export class NameChangeEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'nome_anterior' })
  nomeAnterior!: string;

  @Column({ name: 'nome_novo' })
  nomeNovo!: string;

  @Column({ name: 'alterado_em', type: 'timestamptz' })
  alteradoEm!: Date;
}
