import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Nota fiscal já importada (chave de acesso) — evita importar a mesma 2x. */
@Entity('nfce_imports')
export class NfceImportEntity {
  @PrimaryColumn()
  chave!: string;

  @Column({ name: 'reporter_id' })
  reporterId!: string;

  @CreateDateColumn({ name: 'imported_at' })
  importedAt!: Date;
}
