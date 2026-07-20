import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { SavedListItemDTO } from '@meumercado/contracts';

/** Lista de compras salva (modelo reutilizável) — dado pessoal privado. */
@Entity('listas')
export class ListaEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @Column()
  nome!: string;

  @Column({ type: 'jsonb' })
  itens!: SavedListItemDTO[];

  @Column({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;
}
