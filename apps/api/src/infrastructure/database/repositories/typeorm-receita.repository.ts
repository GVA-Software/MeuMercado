import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ReceitaRepository,
  ReceitaStored,
} from '../../../modules/insights/receita.repository.js';
import { NinaReceitaEntity } from '../entities/nina-receita.entity.js';

@Injectable()
export class TypeOrmReceitaRepository implements ReceitaRepository {
  constructor(
    @InjectRepository(NinaReceitaEntity)
    private readonly repo: Repository<NinaReceitaEntity>,
  ) {}

  listar(): Promise<ReceitaStored[]> {
    return this.repo.find({ order: { criadoEm: 'DESC' } });
  }
  async salvar(r: ReceitaStored): Promise<void> {
    await this.repo.upsert(r, ['nome']);
  }
  async remover(nome: string): Promise<void> {
    await this.repo.delete({ nome });
  }
}
