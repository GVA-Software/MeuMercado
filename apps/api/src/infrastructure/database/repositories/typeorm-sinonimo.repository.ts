import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  SinonimoRepository,
  SinonimoStored,
} from '../../../modules/insights/sinonimo.repository.js';
import { NinaSinonimoEntity } from '../entities/nina-sinonimo.entity.js';

@Injectable()
export class TypeOrmSinonimoRepository implements SinonimoRepository {
  constructor(
    @InjectRepository(NinaSinonimoEntity)
    private readonly repo: Repository<NinaSinonimoEntity>,
  ) {}

  listar(): Promise<SinonimoStored[]> {
    return this.repo.find({ order: { criadoEm: 'DESC' } });
  }
  async salvar(s: SinonimoStored): Promise<void> {
    await this.repo.upsert(s, ['alias']);
  }
  async remover(alias: string): Promise<void> {
    await this.repo.delete({ alias });
  }
}
