import { Injectable } from '@nestjs/common';

/**
 * Cache PERSISTENTE dos resultados do Overpass (OSM) por área. O público é lento
 * (~60s) e o cache em memória some no cold start do Render — persistir no banco faz
 * cada área ser buscada UMA vez (devagar, em 2º plano) e ficar cacheada pra sempre,
 * sobrevivendo a reinícios. `elements` é o payload cru do Overpass (jsonb).
 */
export interface OsmCacheRepository {
  get(chave: string): Promise<{ elements: unknown[]; atualizadoEm: Date } | null>;
  set(chave: string, elements: unknown[]): Promise<void>;
}

export const OSM_CACHE_REPOSITORY = 'OSM_CACHE_REPOSITORY';

@Injectable()
export class InMemoryOsmCacheRepository implements OsmCacheRepository {
  private readonly cache = new Map<string, { elements: unknown[]; atualizadoEm: Date }>();

  get(chave: string): Promise<{ elements: unknown[]; atualizadoEm: Date } | null> {
    return Promise.resolve(this.cache.get(chave) ?? null);
  }

  set(chave: string, elements: unknown[]): Promise<void> {
    this.cache.set(chave, { elements, atualizadoEm: new Date() });
    return Promise.resolve();
  }
}
