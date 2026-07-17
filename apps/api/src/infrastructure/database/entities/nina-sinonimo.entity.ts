import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Sinônimo dinâmico ensinado pelo ADM (alias → termo do catálogo). */
@Entity('nina_sinonimos')
export class NinaSinonimoEntity {
  @PrimaryColumn()
  alias!: string;

  @Column()
  canonico!: string;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}
