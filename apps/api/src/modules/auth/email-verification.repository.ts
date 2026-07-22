import { Injectable } from '@nestjs/common';

/**
 * Pedido de confirmação de e-mail. Guardamos só o HASH do token (o token vai no
 * link do e-mail); expira em 24h e é de uso único. Espelha o PasswordReset.
 */
export interface EmailVerification {
  id: string;
  userId: string;
  tokenHash: string;
  expiraEm: Date;
  usado: boolean;
}

/** Porta dos pedidos de confirmação de e-mail. */
export interface EmailVerificationRepository {
  criar(v: EmailVerification): Promise<void>;
  buscarPorHash(tokenHash: string): Promise<EmailVerification | null>;
  marcarUsado(id: string): Promise<void>;
  /** Invalida os pedidos pendentes do usuário (ao criar um novo). */
  invalidarDoUsuario(userId: string): Promise<void>;
}

export const EMAIL_VERIFICATION_REPOSITORY = 'EMAIL_VERIFICATION_REPOSITORY';

@Injectable()
export class InMemoryEmailVerificationRepository implements EmailVerificationRepository {
  private readonly byId = new Map<string, EmailVerification>();

  criar(v: EmailVerification): Promise<void> {
    this.byId.set(v.id, v);
    return Promise.resolve();
  }
  buscarPorHash(tokenHash: string): Promise<EmailVerification | null> {
    for (const r of this.byId.values()) if (r.tokenHash === tokenHash) return Promise.resolve(r);
    return Promise.resolve(null);
  }
  marcarUsado(id: string): Promise<void> {
    const r = this.byId.get(id);
    if (r) r.usado = true;
    return Promise.resolve();
  }
  invalidarDoUsuario(userId: string): Promise<void> {
    for (const r of this.byId.values()) if (r.userId === userId && !r.usado) r.usado = true;
    return Promise.resolve();
  }
}
