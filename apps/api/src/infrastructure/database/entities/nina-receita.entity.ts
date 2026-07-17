import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Receita/evento dinâmica ensinada pelo ADM (gatilhos → itens). */
@Entity('nina_receitas')
export class NinaReceitaEntity {
  @PrimaryColumn()
  nome!: string;

  @Column({ type: 'jsonb' })
  gatilhos!: string[];

  @Column({ type: 'jsonb' })
  itens!: string[];

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
