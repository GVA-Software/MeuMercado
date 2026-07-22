import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  nome!: string;

  /** null = conta só-Google (sem senha). */
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash!: string | null;

  /** Identidade Google (`sub`), única. Muitos NULL convivem (contas não-Google). */
  @Column({ name: 'google_sub', type: 'varchar', nullable: true, unique: true })
  googleSub!: string | null;

  /** URL da foto do Google (avatar padrão). */
  @Column({ name: 'foto_url', type: 'varchar', length: 512, nullable: true })
  fotoUrl!: string | null;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  /** Soft-delete: conta excluída (bloqueia login; os preços dela ficam na base). */
  @Column({ name: 'excluido_em', type: 'timestamptz', nullable: true })
  excluidoEm!: Date | null;

  /** Versão da Política/Termos aceita (consentimento LGPD). */
  @Column({ name: 'politica_versao', type: 'varchar', nullable: true })
  politicaVersao!: string | null;

  /** Quando aceitou a versão atual (cadastro ou reaceite). */
  @Column({ name: 'politica_aceita_em', type: 'timestamptz', nullable: true })
  politicaAceitaEm!: Date | null;

  /** E-mail confirmado por link? Nullable de propósito: contas ANTIGAS (coluna recém
   *  criada) nascem NULL e são tratadas como confirmadas (sem incomodar quem já usa). */
  @Column({ name: 'email_verificado', type: 'boolean', nullable: true })
  emailVerificado!: boolean | null;
}
