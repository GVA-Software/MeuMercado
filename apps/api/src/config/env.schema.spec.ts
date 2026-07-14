import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.schema.js';

// Config de produção mínima e VÁLIDA (segredos reais). Cada teste quebra um item.
const prodOk = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  COOKIE_SECURE: 'true',
  CRON_SECRET: 'cron-secret-real-e-forte-123456',
  VAPID_PRIVATE_KEY: 'vapid-private-real-e-forte-123456',
};

describe('validateEnv — blindagem de produção', () => {
  it('aceita produção com segredos reais', () => {
    expect(() => validateEnv({ ...prodOk })).not.toThrow();
  });

  it('recusa o CRON_SECRET default (público) em produção', () => {
    expect(() =>
      validateEnv({ ...prodOk, CRON_SECRET: 'mzv_8tNV1GBcU5qoVMFIdEBhhAPYQtm0' }),
    ).toThrow(/CRON_SECRET/);
  });

  it('recusa a VAPID_PRIVATE_KEY default (pública) em produção', () => {
    expect(() =>
      validateEnv({ ...prodOk, VAPID_PRIVATE_KEY: 'Nt1nOi2pGURXIZPk3aZSgg7Ij25n1IOGNKCv-CRbxs4' }),
    ).toThrow(/VAPID_PRIVATE_KEY/);
  });

  it('recusa JWT secret fraco/curto em produção', () => {
    expect(() => validateEnv({ ...prodOk, JWT_ACCESS_SECRET: 'curto' })).toThrow(/JWT/);
  });

  it('recusa COOKIE_SECURE=false em produção', () => {
    expect(() => validateEnv({ ...prodOk, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
  });

  it('em desenvolvimento aceita os defaults (dev roda sem configurar nada)', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
  });
});
