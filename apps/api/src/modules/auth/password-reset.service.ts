import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Email } from '@meumercado/domain';
import { USER_REPOSITORY, type UserRepository } from './user.repository.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password.hasher.js';
import {
  REFRESH_SESSION_REPOSITORY,
  type RefreshSessionRepository,
} from './refresh-session.repository.js';
import {
  PASSWORD_RESET_REPOSITORY,
  type PasswordResetRepository,
} from './password-reset.repository.js';
import { EMAIL_SERVICE, type EmailService } from '../email/email.service.js';
import { emailRedefinicaoSenha } from '../email/templates.js';

const VALIDADE_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_SESSION_REPOSITORY) private readonly sessions: RefreshSessionRepository,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly resets: PasswordResetRepository,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Pede a recuperação. SEMPRE resolve (não revela se o e-mail existe) — só manda o
   * link se o usuário existir. O token vai no link; guardamos apenas o hash.
   */
  async esqueciSenha(emailRaw: string, baseUrl: string): Promise<void> {
    let email: string;
    try {
      email = new Email(emailRaw).value;
    } catch {
      return; // e-mail malformado: silencioso
    }
    const user = await this.users.findByEmail(email);
    if (!user) return; // anti-enumeração
    await this.resets.invalidarDoUsuario(user.id);
    const token = randomBytes(32).toString('base64url');
    await this.resets.criar({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.hashToken(token),
      expiraEm: new Date(Date.now() + VALIDADE_MS),
      usado: false,
    });
    const link = `${baseUrl}/?reset=${token}`;
    const nome = user.nome.trim().split(/\s+/)[0] ?? user.nome;
    const { assunto, texto, html } = emailRedefinicaoSenha(nome, link);
    await this.email.enviar(user.email, assunto, texto, html);
  }

  /** Redefine a senha a partir do token do e-mail. Lança se inválido/expirado/usado. */
  async redefinirSenha(token: string, novaSenha: string): Promise<void> {
    const reset = await this.resets.buscarPorHash(this.hashToken(token));
    if (!reset || reset.usado || reset.expiraEm.getTime() < Date.now()) {
      throw new UnauthorizedException('Link inválido ou expirado. Peça um novo.');
    }
    const user = await this.users.findById(reset.userId);
    if (!user) throw new UnauthorizedException('Link inválido ou expirado. Peça um novo.');
    await this.users.updateSenha(user.id, await this.hasher.hash(novaSenha));
    await this.resets.marcarUsado(reset.id);
    // Segurança: derruba todas as sessões (se a conta foi comprometida, expulsa o invasor).
    await this.sessions.revogarTodasDoUsuario(user.id);
  }
}
