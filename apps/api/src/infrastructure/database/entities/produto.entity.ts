import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Produto do catálogo. Criados pelos usuários ficam gravados aqui. */
@Entity('produtos')
export class ProdutoEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  nome!: string;

  @Column()
  categoria!: string;

  @Column()
  unidade!: string;

  @Column({ type: 'varchar', nullable: true })
  emoji!: string | null;
}
