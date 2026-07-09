import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  NameChange,
  NameChangeRepository,
} from '../../../modules/auth/name-change.repository.js';
import { NameChangeEntity } from '../entities/name-change.entity.js';

@Injectable()
export class TypeOrmNameChangeRepository implements NameChangeRepository {
  constructor(
    @InjectRepository(NameChangeEntity) private readonly repo: Repository<NameChangeEntity>,
  ) {}

  async registrar(rec: NameChange): Promise<void> {
    await this.repo.insert(rec);
  }

  async listar(userId: string): Promise<NameChange[]> {
    return this.repo.find({ where: { userId }, order: { alteradoEm: 'DESC' } });
  }
}
