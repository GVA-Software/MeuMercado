import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Email } from '@meumercado/domain';
import type { AuthResponse, LoginInput, RegisterInput, UserDTO } from '@meumercado/contracts';
import { PASSWORD_HASHER, type PasswordHasher } from './password.hasher.js';
import { USER_REPOSITORY, type StoredUser, type UserRepository } from './user.repository.js';
import { TokenService } from './token.service.js';

export interface AuthResult {
  response: AuthResponse;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = new Email(input.email).value; // valida + normaliza
    if (this.users.findByEmail(email)) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const user: StoredUser = {
      id: randomUUID(),
      email,
      nome: input.nome.trim(),
      passwordHash: await this.hasher.hash(input.senha),
      criadoEm: new Date(),
    };
    this.users.create(user);
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = new Email(input.email).value;
    const user = this.users.findByEmail(email);
    // Resposta idêntica para "não existe" e "senha errada": não revela quais e-mails existem.
    if (!user || !(await this.hasher.verify(user.passwordHash, input.senha))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.issue(user);
  }

  me(userId: string): UserDTO {
    const user = this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.toDTO(user);
  }

  refresh(userId: string): AuthResult {
    const user = this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.issue(user);
  }

  private issue(user: StoredUser): AuthResult {
    return {
      response: {
        accessToken: this.tokens.signAccess({ sub: user.id, email: user.email }),
        user: this.toDTO(user),
      },
      refreshToken: this.tokens.signRefresh(user.id),
    };
  }

  private toDTO(user: StoredUser): UserDTO {
    return { id: user.id, email: user.email, nome: user.nome };
  }
}
