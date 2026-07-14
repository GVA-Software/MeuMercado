import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import type { Env } from '../../config/env.schema.js';

export interface AccessPayload {
  sub: string;
  email: string;
}

/** Assina/verifica JWTs. Access e refresh usam segredos SEPARADOS. */
@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  signAccess(payload: AccessPayload): string {
    return this.sign(
      payload,
      this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      this.config.get('JWT_ACCESS_TTL', { infer: true }),
    );
  }

  /** `jti` = id da sessão de refresh no servidor (permite revogar/rotacionar). */
  signRefresh(sub: string, jti: string): string {
    return this.sign(
      { sub, jti },
      this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      this.config.get('JWT_REFRESH_TTL', { infer: true }),
    );
  }

  verifyAccess(token: string): AccessPayload {
    const secret = this.config.get('JWT_ACCESS_SECRET', { infer: true }) as Secret;
    // Fixa o algoritmo aceito: impede ataques de confusão de algoritmo (ex.: um
    // token forjado com "alg":"none" ou trocando HS/RS) — só HS256 é honrado.
    return jwt.verify(token, secret, { algorithms: ['HS256'] }) as unknown as AccessPayload;
  }

  verifyRefresh(token: string): { sub: string; jti?: string } {
    const secret = this.config.get('JWT_REFRESH_SECRET', { infer: true }) as Secret;
    return jwt.verify(token, secret, { algorithms: ['HS256'] }) as unknown as {
      sub: string;
      jti?: string;
    };
  }

  get refreshTtlMs(): number {
    return this.config.get('JWT_REFRESH_TTL', { infer: true }) * 1000;
  }

  private sign(payload: object, secret: string, ttlSeconds: number): string {
    const options: SignOptions = { expiresIn: ttlSeconds, algorithm: 'HS256' };
    return jwt.sign(payload, secret as Secret, options);
  }
}
