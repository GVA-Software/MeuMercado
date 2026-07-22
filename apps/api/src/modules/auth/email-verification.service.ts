import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { USER_REPOSITORY, type UserRepository } from './user.repository.js';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerificationRepository,
} from './email-verification.repository.js';
import { EMAIL_SERVICE, type EmailService } from '../email/email.service.js';
import { emailConfirmacaoEmail } from '../email/templates.js';

const VALIDADE_MS = 24 * 60 * 60 * 1000; // 24 horas (mais folgado que o reset de senha)

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly verificacoes: EmailVerificationRepository,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Manda o link de confirmação para o usuário. Se NÃO há transporte de e-mail
   * (dev/sem SMTP/Gmail), não há como confirmar → marca o e-mail como verificado e
   * devolve `false` (o controller então não deixa o banner aparecer). Devolve `true`
   * quando o e-mail foi disparado (best-effort — `enviar` nunca lança).
   */
  async enviarVerificacao(userId: string, baseUrl: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (!user) return false;
    if (!this.email.estaLigado()) {
      await this.users.marcarEmailVerificado(user.id);
      return false;
    }
    await this.verificacoes.invalidarDoUsuario(user.id);
    const token = randomBytes(32).toString('base64url');
    await this.verificacoes.criar({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.hashToken(token),
      expiraEm: new Date(Date.now() + VALIDADE_MS),
      usado: false,
    });
    const link = `${baseUrl}/?verificar-email=${token}`;
    const nome = user.nome.trim().split(/\s+/)[0] ?? user.nome;
    const { assunto, texto, html } = emailConfirmacaoEmail(nome, link);
    await this.email.enviar(user.email, assunto, texto, html);
    return true;
  }

  /** Confirma o e-mail a partir do token do link. Lança se inválido/expirado/usado. */
  async confirmar(token: string): Promise<void> {
    const v = await this.verificacoes.buscarPorHash(this.hashToken(token));
    if (!v || v.usado || v.expiraEm.getTime() < Date.now()) {
      throw new UnauthorizedException('Link inválido ou expirado. Peça um novo.');
    }
    const user = await this.users.findById(v.userId);
    if (!user) throw new UnauthorizedException('Link inválido ou expirado. Peça um novo.');
    await this.users.marcarEmailVerificado(user.id);
    await this.verificacoes.marcarUsado(v.id);
  }
}
