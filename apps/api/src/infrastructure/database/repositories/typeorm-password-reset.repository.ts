import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  PasswordReset,
  PasswordResetRepository,
} from '../../../modules/auth/password-reset.repository.js';
import { PasswordResetEntity } from '../entities/password-reset.entity.js';

@Injectable()
export class TypeOrmPasswordResetRepository implements PasswordResetRepository {
  constructor(
    @InjectRepository(PasswordResetEntity)
    private readonly repo: Repository<PasswordResetEntity>,
  ) {}

  async criar(reset: PasswordReset): Promise<void> {
    await this.repo.insert(reset);
  }

  buscarPorHash(tokenHash: string): Promise<PasswordReset | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async marcarUsado(id: string): Promise<void> {
    await this.repo.update({ id }, { usado: true });
  }

  async invalidarDoUsuario(userId: string): Promise<void> {
    await this.repo.update({ userId, usado: false }, { usado: true });
  }
}
