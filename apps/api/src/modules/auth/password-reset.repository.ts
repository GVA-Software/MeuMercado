import { Injectable } from '@nestjs/common';

/**
 * Pedido de recuperação de senha. Guardamos só o HASH do token (o token vai no
 * link do e-mail); expira em 1h e é de uso único.
 */
export interface PasswordReset {
  id: string;
  userId: string;
  tokenHash: string;
  expiraEm: Date;
  usado: boolean;
}

/** Porta dos pedidos de reset de senha. */
export interface PasswordResetRepository {
  criar(reset: PasswordReset): Promise<void>;
  buscarPorHash(tokenHash: string): Promise<PasswordReset | null>;
  marcarUsado(id: string): Promise<void>;
  /** Invalida os pedidos pendentes do usuário (ao criar um novo). */
  invalidarDoUsuario(userId: string): Promise<void>;
}

export const PASSWORD_RESET_REPOSITORY = 'PASSWORD_RESET_REPOSITORY';

@Injectable()
export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  private readonly byId = new Map<string, PasswordReset>();

  criar(reset: PasswordReset): Promise<void> {
    this.byId.set(reset.id, reset);
    return Promise.resolve();
  }
  buscarPorHash(tokenHash: string): Promise<PasswordReset | null> {
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
