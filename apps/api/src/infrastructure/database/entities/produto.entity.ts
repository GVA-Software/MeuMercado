import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

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

  @Index()
  @Column({ name: 'codigo_externo', type: 'varchar', nullable: true })
  codigoExterno!: string | null;

  /** Código de barras global (EAN/UPC) — casa o produto ao bipar. */
  @Index()
  @Column({ name: 'ean', type: 'varchar', nullable: true })
  ean!: string | null;

  /**
   * Oculto: itens da base (seed) são fixos no código; pra "excluí-los" gravamos aqui
   * uma linha materializada com hidden=true, que o findAll passa a esconder. Também
   * materializa edições de itens de seed (nome/categoria).
   */
  @Column({ type: 'boolean', default: false })
  hidden!: boolean;
}
