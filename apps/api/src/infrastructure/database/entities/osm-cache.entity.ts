import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Cache persistente do Overpass (OSM) por área — sobrevive aos cold starts do Render. */
@Entity('osm_cache')
export class OsmCacheEntity {
  /** Chave da área: "lat.toFixed(2),lng.toFixed(2),raio". */
  @PrimaryColumn()
  chave!: string;

  /** Payload cru do Overpass (elements). */
  @Column({ type: 'jsonb' })
  elements!: unknown[];

  @Column({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}
