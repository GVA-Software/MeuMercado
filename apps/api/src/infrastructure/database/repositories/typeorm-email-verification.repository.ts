import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  EmailVerification,
  EmailVerificationRepository,
} from '../../../modules/auth/email-verification.repository.js';
import { EmailVerificationEntity } from '../entities/email-verification.entity.js';

@Injectable()
export class TypeOrmEmailVerificationRepository implements EmailVerificationRepository {
  constructor(
    @InjectRepository(EmailVerificationEntity)
    private readonly repo: Repository<EmailVerificationEntity>,
  ) {}

  async criar(v: EmailVerification): Promise<void> {
    await this.repo.insert(v);
  }

  buscarPorHash(tokenHash: string): Promise<EmailVerification | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async marcarUsado(id: string): Promise<void> {
    await this.repo.update({ id }, { usado: true });
  }

  async invalidarDoUsuario(userId: string): Promise<void> {
    await this.repo.update({ userId, usado: false }, { usado: true });
  }
}
