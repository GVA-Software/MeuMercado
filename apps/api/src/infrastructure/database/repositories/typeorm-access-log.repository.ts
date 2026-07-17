import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  AccessLogEntry,
  AccessLogRepository,
} from '../../../modules/audit/access-log.repository.js';
import { AccessLogEntity } from '../entities/access-log.entity.js';

@Injectable()
export class TypeOrmAccessLogRepository implements AccessLogRepository {
  constructor(
    @InjectRepository(AccessLogEntity)
    private readonly repo: Repository<AccessLogEntity>,
  ) {}

  async registrar(entry: AccessLogEntry): Promise<void> {
    await this.repo.insert(entry);
  }

  listarPorUsuario(userId: string, limite = 500): Promise<AccessLogEntry[]> {
    return this.repo.find({ where: { userId }, order: { criadoEm: 'DESC' }, take: limite });
  }
}
