import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OsmCacheRepository } from '../../../modules/markets/osm-cache.repository.js';
import { OsmCacheEntity } from '../entities/osm-cache.entity.js';

@Injectable()
export class TypeOrmOsmCacheRepository implements OsmCacheRepository {
  constructor(
    @InjectRepository(OsmCacheEntity) private readonly repo: Repository<OsmCacheEntity>,
  ) {}

  async get(chave: string): Promise<{ elements: unknown[]; atualizadoEm: Date } | null> {
    const row = await this.repo.findOne({ where: { chave } });
    return row ? { elements: row.elements, atualizadoEm: row.atualizadoEm } : null;
  }

  async set(chave: string, elements: unknown[]): Promise<void> {
    // upsert: uma linha por área (a chave é PK).
    await this.repo.save({ chave, elements, atualizadoEm: new Date() });
  }
}
