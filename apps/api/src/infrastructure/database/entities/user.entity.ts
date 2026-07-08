import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  nome!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
