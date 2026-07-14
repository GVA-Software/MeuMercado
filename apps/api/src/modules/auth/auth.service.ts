import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Email } from '@meumercado/domain';
import type { AuthResponse, LoginInput, RegisterInput, UserDTO } from '@meumercado/contracts';
import type { Env } from '../../config/env.schema.js';
import { isAdminEmail } from '../../common/admin-emails.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password.hasher.js';
import { USER_REPOSITORY, type StoredUser, type UserRepository } from './user.repository.js';
import { NAME_CHANGE_REPOSITORY, type NameChangeRepository } from './name-change.repository.js';
import { TokenService } from './token.service.js';

export interface AuthResult {
  response: AuthResponse;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(NAME_CHANGE_REPOSITORY) private readonly nameChanges: NameChangeRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = new Email(input.email).value; // valida + normaliza
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const user: StoredUser = {
      id: randomUUID(),
      email,
      nome: input.nome.trim(),
      passwordHash: await this.hasher.hash(input.senha),
      criadoEm: new Date(),
    };
    await this.users.create(user);
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = new Email(input.email).value;
    const user = await this.users.findByEmail(email);
    // Resposta idêntica para "não existe" e "senha errada" — E mesmo custo de tempo:
    // quando o e-mail não existe, roda um scrypt "descartável" com o MESMO peso da
    // verificação real, para não vazar a existência da conta por diferença de latência
    // (oráculo de enumeração por timing).
    if (!user) {
      await this.hasher.hash(input.senha);
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!(await this.hasher.verify(user.passwordHash, input.senha))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.issue(user);
  }

  async me(userId: string): Promise<UserDTO> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.toDTO(user);
  }

  /** Atualiza o nome do próprio usuário e guarda a alteração na trilha de auditoria. */
  async updateNome(userId: string, nome: string): Promise<UserDTO> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const novo = nome.trim();
    if (novo && novo !== user.nome) {
      await this.nameChanges.registrar({
        id: randomUUID(),
        userId: user.id,
        nomeAnterior: user.nome,
        nomeNovo: novo,
        alteradoEm: new Date(),
      });
      await this.users.updateNome(user.id, novo);
      user.nome = novo;
    }
    return this.toDTO(user);
  }

  async refresh(userId: string): Promise<AuthResult> {
    const user = await this.users.findById(userId);
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
    return {
      id: user.id,
      email: user.email,
      nome: user.nome,
      isAdmin: isAdminEmail(user.email, this.config.get('ADMIN_EMAILS', { infer: true })),
    };
  }
}
