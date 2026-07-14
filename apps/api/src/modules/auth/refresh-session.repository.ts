import { Injectable } from '@nestjs/common';

/**
 * Uma sessão de refresh = um "assento" de login. O refresh JWT carrega o `jti`
 * desta sessão; o servidor pode então REVOGAR a sessão (logout, detecção de reuso)
 * mesmo o token sendo stateless. Habilita rotação com detecção de reuso.
 */
export interface RefreshSession {
  jti: string;
  userId: string;
  revoked: boolean;
  revokedAt: Date | null;
  /** jti que substituiu esta sessão numa rotação (null se ativa ou revogada por logout). */
  replacedByJti: string | null;
  expiresAt: Date;
  criadoEm: Date;
}

/** Porta das sessões de refresh (criar, buscar, revogar, revogar-família). */
export interface RefreshSessionRepository {
  criar(session: RefreshSession): Promise<void>;
  buscar(jti: string): Promise<RefreshSession | null>;
  /** Marca revogada (idempotente), opcionalmente apontando para quem a substituiu. */
  revogar(jti: string, replacedByJti: string | null): Promise<void>;
  /** Revoga TODAS as sessões vivas do usuário — usado ao detectar reuso de token. */
  revogarTodasDoUsuario(userId: string): Promise<void>;
}

export const REFRESH_SESSION_REPOSITORY = 'REFRESH_SESSION_REPOSITORY';

@Injectable()
export class InMemoryRefreshSessionRepository implements RefreshSessionRepository {
  private readonly byJti = new Map<string, RefreshSession>();

  criar(session: RefreshSession): Promise<void> {
    this.byJti.set(session.jti, session);
    return Promise.resolve();
  }
  buscar(jti: string): Promise<RefreshSession | null> {
    return Promise.resolve(this.byJti.get(jti) ?? null);
  }
  revogar(jti: string, replacedByJti: string | null): Promise<void> {
    const s = this.byJti.get(jti);
    if (s && !s.revoked) {
      s.revoked = true;
      s.revokedAt = new Date();
      s.replacedByJti = replacedByJti;
    }
    return Promise.resolve();
  }
  revogarTodasDoUsuario(userId: string): Promise<void> {
    for (const s of this.byJti.values()) {
      if (s.userId === userId && !s.revoked) {
        s.revoked = true;
        s.revokedAt = new Date();
      }
    }
    return Promise.resolve();
  }
}
