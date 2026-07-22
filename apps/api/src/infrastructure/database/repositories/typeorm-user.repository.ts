import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NOME_EXCLUIDO,
  emailAnonimo,
  type StoredUser,
  type UserRepository,
} from '../../../modules/auth/user.repository.js';
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

  async findByGoogleSub(sub: string): Promise<StoredUser | null> {
    return this.repo.findOne({ where: { googleSub: sub } });
  }

  async create(user: StoredUser): Promise<void> {
    await this.repo.insert(user);
  }

  async vincularGoogle(id: string, googleSub: string): Promise<void> {
    await this.repo.update(id, { googleSub });
  }

  async atualizarFotoGoogle(id: string, fotoUrl: string): Promise<void> {
    await this.repo.update(id, { fotoUrl });
  }

  async updateNome(id: string, nome: string): Promise<void> {
    await this.repo.update(id, { nome });
  }

  async updateSenha(id: string, passwordHash: string): Promise<void> {
    await this.repo.update(id, { passwordHash });
  }

  async invalidarSenha(id: string): Promise<void> {
    await this.repo.update(id, { passwordHash: null });
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

  async marcarExcluido(id: string, quando: Date): Promise<void> {
    // Anonimiza (LGPD) e libera o e-mail original; os preços com este reporterId ficam.
    await this.repo.update(id, {
      excluidoEm: quando,
      nome: NOME_EXCLUIDO,
      email: emailAnonimo(id),
      passwordHash: null,
      googleSub: null, // solta o vínculo Google (relogar cria conta nova, não bate na excluída)
      fotoUrl: null, // some a foto (PII)
    });
  }

  async registrarAceitePolitica(id: string, versao: string, quando: Date): Promise<void> {
    await this.repo.update(id, { politicaVersao: versao, politicaAceitaEm: quando });
  }

  async marcarEmailVerificado(id: string): Promise<void> {
    await this.repo.update(id, { emailVerificado: true });
  }
}
