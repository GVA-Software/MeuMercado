import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { GoogleTokenVerifier } from './google-token.verifier.js';

const CLIENT_ID = '123-abc.apps.googleusercontent.com';
const KID = 'test-kid-1';

// Par RSA de teste — o "Google" assina com a privada; o verifier valida com a pública
// (servida como JWKS mockado). Zero rede.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const publicJwk = publicKey.export({ format: 'jwk' });
const JWKS = { keys: [{ ...publicJwk, kid: KID, use: 'sig', alg: 'RS256' }] };

// Segunda chave — para forjar um token com assinatura que NÃO bate com o JWKS.
const outra = generateKeyPairSync('rsa', { modulusLength: 2048 });
const outraPem = outra.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

function assinar(payload: object, opts: jwt.SignOptions = {}, key = privatePem): string {
  return jwt.sign(payload, key, {
    algorithm: 'RS256',
    keyid: KID,
    audience: CLIENT_ID,
    issuer: 'https://accounts.google.com',
    subject: 'sub-123',
    expiresIn: '1h',
    ...opts,
  });
}

function configCom(clientId?: string): ConfigService<Env, true> {
  return { get: () => clientId } as unknown as ConfigService<Env, true>;
}

function mockJwks(jwks: unknown = JWKS): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jwks),
        headers: { get: () => null },
      }),
    ),
  );
}

describe('GoogleTokenVerifier', () => {
  beforeEach(() => mockJwks());
  afterEach(() => vi.unstubAllGlobals());

  it('token válido + email_verified → devolve a identidade', async () => {
    const v = new GoogleTokenVerifier(configCom(CLIENT_ID));
    const token = assinar({ email: 'user@x.com', email_verified: true, name: 'User' });
    const id = await v.verificar(token);
    expect(id).toMatchObject({
      sub: 'sub-123',
      email: 'user@x.com',
      emailVerified: true,
      nome: 'User',
    });
  });

  it('audience errada → rejeita', async () => {
    const v = new GoogleTokenVerifier(configCom(CLIENT_ID));
    const token = assinar({ email: 'u@x.com', email_verified: true }, { audience: 'outro-client' });
    await expect(v.verificar(token)).rejects.toThrow();
  });

  it('issuer inesperado → rejeita', async () => {
    const v = new GoogleTokenVerifier(configCom(CLIENT_ID));
    const token = assinar(
      { email: 'u@x.com', email_verified: true },
      { issuer: 'https://evil.com' },
    );
    await expect(v.verificar(token)).rejects.toThrow();
  });

  it('email_verified=false → rejeita (NUNCA segue com e-mail não verificado)', async () => {
    const v = new GoogleTokenVerifier(configCom(CLIENT_ID));
    const token = assinar({ email: 'u@x.com', email_verified: false });
    await expect(v.verificar(token)).rejects.toThrow();
  });

  it('assinatura que não bate com o JWKS → rejeita', async () => {
    const v = new GoogleTokenVerifier(configCom(CLIENT_ID));
    const token = assinar({ email: 'u@x.com', email_verified: true }, {}, outraPem);
    await expect(v.verificar(token)).rejects.toThrow();
  });

  it('token expirado → rejeita', async () => {
    const v = new GoogleTokenVerifier(configCom(CLIENT_ID));
    const token = assinar({ email: 'u@x.com', email_verified: true }, { expiresIn: '-1h' });
    await expect(v.verificar(token)).rejects.toThrow();
  });

  it('GOOGLE_CLIENT_ID ausente → recurso desligado (rejeita sem nem checar)', async () => {
    const v = new GoogleTokenVerifier(configCom(undefined));
    expect(v.habilitado).toBe(false);
    const token = assinar({ email: 'u@x.com', email_verified: true });
    await expect(v.verificar(token)).rejects.toThrow();
  });
});
