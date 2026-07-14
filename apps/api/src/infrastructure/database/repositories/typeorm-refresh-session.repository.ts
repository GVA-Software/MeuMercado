import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  RefreshSession,
  RefreshSessionRepository,
} from '../../../modules/auth/refresh-session.repository.js';
import { RefreshSessionEntity } from '../entities/refresh-session.entity.js';

@Injectable()
export class TypeOrmRefreshSessionRepository implements RefreshSessionRepository {
  constructor(
    @InjectRepository(RefreshSessionEntity)
    private readonly repo: Repository<RefreshSessionEntity>,
  ) {}

  async criar(session: RefreshSession): Promise<void> {
    await this.repo.insert(session);
  }

  buscar(jti: string): Promise<RefreshSession | null> {
    return this.repo.findOne({ where: { jti } });
  }

  async revogar(jti: string, replacedByJti: string | null): Promise<void> {
    // Só revoga quem ainda está vivo (idempotente; não sobrescreve revogações anteriores).
    await this.repo.update(
      { jti, revoked: false },
      { revoked: true, revokedAt: new Date(), replacedByJti },
    );
  }

  async revogarTodasDoUsuario(userId: string): Promise<void> {
    await this.repo.update({ userId, revoked: false }, { revoked: true, revokedAt: new Date() });
  }
}
