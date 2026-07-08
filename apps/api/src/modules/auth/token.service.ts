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

  signRefresh(sub: string): string {
    return this.sign(
      { sub },
      this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      this.config.get('JWT_REFRESH_TTL', { infer: true }),
    );
  }

  verifyAccess(token: string): AccessPayload {
    const secret = this.config.get('JWT_ACCESS_SECRET', { infer: true }) as Secret;
    return jwt.verify(token, secret) as unknown as AccessPayload;
  }

  verifyRefresh(token: string): { sub: string } {
    const secret = this.config.get('JWT_REFRESH_SECRET', { infer: true }) as Secret;
    return jwt.verify(token, secret) as unknown as { sub: string };
  }

  get refreshTtlMs(): number {
    return this.config.get('JWT_REFRESH_TTL', { infer: true }) * 1000;
  }

  private sign(payload: object, secret: string, ttlSeconds: number): string {
    const options: SignOptions = { expiresIn: ttlSeconds };
    return jwt.sign(payload, secret as Secret, options);
  }
}
