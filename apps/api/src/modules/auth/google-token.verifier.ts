import { createPublicKey } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import type { Env } from '../../config/env.schema.js';

/** Certificados públicos do Google (JWKS) — endpoint gratuito, como Nominatim/OFF. */
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
/** `iss` aceitos num ID token do Google (tupla não-vazia p/ o tipo do jsonwebtoken). */
const GOOGLE_ISS: [string, string] = ['accounts.google.com', 'https://accounts.google.com'];
const JWKS_TIMEOUT_MS = 6000;
const JWKS_FALLBACK_TTL_MS = 3_600_000; // 1h se o Cache-Control não disser

interface Jwk {
  kid: string;
  n: string;
  e: string;
  kty: string;
  alg?: string;
  use?: string;
}

/** Identidade extraída de um ID token do Google já verificado. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  nome: string;
}

/**
 * Verifica o ID token do Google SEM dependência nova: baixa o JWKS público do Google
 * (cache com rotação), acha a chave pelo `kid` e valida com o `jsonwebtoken` já
 * presente — assinatura (RS256) + `aud` (nosso GOOGLE_CLIENT_ID) + `iss` + `exp`.
 * O `email_verified` é conferido À MÃO (nenhuma lib faz isso) — regra que impede
 * sequestro de conta por e-mail não comprovado. Determinístico e testável sem rede.
 */
@Injectable()
export class GoogleTokenVerifier {
  private chavesPem = new Map<string, string>();
  private expiraEm = 0;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get clientId(): string | undefined {
    return this.config.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  /** true quando a env está setada (recurso ligado). */
  get habilitado(): boolean {
    return Boolean(this.clientId);
  }

  private async carregarChaves(forcar = false): Promise<void> {
    if (!forcar && this.chavesPem.size > 0 && Date.now() < this.expiraEm) return;
    const res = await fetch(GOOGLE_CERTS, { signal: AbortSignal.timeout(JWKS_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`JWKS do Google indisponível (${res.status})`);
    const body = (await res.json()) as { keys: Jwk[] };
    const novo = new Map<string, string>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid) continue;
      const pem = createPublicKey({
        key: jwk,
        format: 'jwk',
      } as unknown as Parameters<typeof createPublicKey>[0]).export({
        type: 'spki',
        format: 'pem',
      }) as string;
      novo.set(jwk.kid, pem);
    }
    if (novo.size === 0) throw new Error('JWKS do Google vazio');
    this.chavesPem = novo;
    const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '');
    this.expiraEm = Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : JWKS_FALLBACK_TTL_MS);
  }

  private async pemPara(kid: string): Promise<string | undefined> {
    await this.carregarChaves();
    let pem = this.chavesPem.get(kid);
    if (!pem) {
      // kid desconhecido → o Google pode ter rotacionado: recarrega uma vez.
      await this.carregarChaves(true);
      pem = this.chavesPem.get(kid);
    }
    return pem;
  }

  async verificar(idToken: string): Promise<GoogleIdentity> {
    const clientId = this.clientId;
    if (!clientId) throw new UnauthorizedException('Login com Google indisponível.');

    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
      throw new UnauthorizedException('Token do Google inválido.');
    }
    const pem = await this.pemPara(decoded.header.kid);
    if (!pem) throw new UnauthorizedException('Chave do Google não encontrada.');

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(idToken, pem, {
        algorithms: ['RS256'],
        audience: clientId,
        issuer: GOOGLE_ISS,
      }) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Token do Google inválido.');
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    // Google manda email_verified como boolean; alguns fluxos legados mandam string.
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const nome = typeof payload.name === 'string' ? payload.name : '';

    if (!sub || !email) throw new UnauthorizedException('Token do Google incompleto.');
    if (!emailVerified) throw new UnauthorizedException('E-mail do Google não verificado.');

    return { sub, email, emailVerified: true, nome };
  }
}
