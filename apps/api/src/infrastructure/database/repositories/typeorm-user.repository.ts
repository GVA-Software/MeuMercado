import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { StoredUser, UserRepository } from '../../../modules/auth/user.repository.js';
import { UserEntity } from '../entities/user.entity.js';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(@InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>) {}

  async findByEmail(email: string): Promise<StoredUser | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<StoredUser | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(user: StoredUser): Promise<void> {
    await this.repo.insert(user);
  }

  async updateNome(id: string, nome: string): Promise<void> {
    await this.repo.update(id, { nome });
  }

  async updateSenha(id: string, passwordHash: string): Promise<void> {
    await this.repo.update(id, { passwordHash });
  }

  async findAll(): Promise<StoredUser[]> {
    return this.repo.find({ order: { criadoEm: 'DESC' } });
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
