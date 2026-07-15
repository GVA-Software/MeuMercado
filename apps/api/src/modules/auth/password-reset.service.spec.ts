import { describe, it, expect } from 'vitest';
import { PasswordResetService } from './password-reset.service.js';
import { InMemoryUserRepository, type StoredUser } from './user.repository.js';
import { InMemoryPasswordResetRepository } from './password-reset.repository.js';
import { InMemoryRefreshSessionRepository } from './refresh-session.repository.js';
import { ScryptPasswordHasher } from './password.hasher.js';
import type { EmailService } from '../email/email.service.js';

function make() {
  const users = new InMemoryUserRepository();
  const resets = new InMemoryPasswordResetRepository();
  const sessions = new InMemoryRefreshSessionRepository();
  const hasher = new ScryptPasswordHasher();
  const emails: Array<[string, string, string]> = [];
  const email: EmailService = {
    enviar: (p, a, c) => {
      emails.push([p, a, c]);
      return Promise.resolve();
    },
    estaLigado: () => true,
    enviarTeste: () => Promise.resolve(),
  };
  const service = new PasswordResetService(users, hasher, sessions, resets, email);
  return { service, users, resets, sessions, emails };
}

const criarUsuario = (email: string, passwordHash: string): StoredUser => ({
  id: 'u1',
  email,
  nome: 'Ana Paula',
  passwordHash,
  criadoEm: new Date('2026-07-01T00:00:00Z'),
});

const tokenDoLink = (corpo: string): string => /reset=([A-Za-z0-9_-]+)/.exec(corpo)?.[1] ?? '';

describe('PasswordResetService', () => {
  it('fluxo completo: pede → e-mail com link → redefine → senha nova + sessões derrubadas', async () => {
    const { service, users, sessions, emails } = make();
    await users.create(criarUsuario('a@b.com', 'antigo'));
    await sessions.criar({
      jti: 'j1',
      userId: 'u1',
      revoked: false,
      revokedAt: null,
      replacedByJti: null,
      expiresAt: new Date(Date.now() + 1_000_000),
      criadoEm: new Date(),
    });

    await service.esqueciSenha('a@b.com', 'https://app.x');
    expect(emails.length).toBe(1);
    expect(emails[0]![0]).toBe('a@b.com');
    const token = tokenDoLink(emails[0]![2]);
    expect(token.length).toBeGreaterThan(10);

    await service.redefinirSenha(token, 'nova-senha-123');
    const u = await users.findById('u1');
    expect(u!.passwordHash).not.toBe('antigo');
    expect(await new ScryptPasswordHasher().verify(u!.passwordHash, 'nova-senha-123')).toBe(true);
    // Sessão anterior derrubada (segurança).
    expect((await sessions.buscar('j1'))!.revoked).toBe(true);
  });

  it('e-mail inexistente: não manda nada (anti-enumeração)', async () => {
    const { service, emails } = make();
    await service.esqueciSenha('naoexiste@x.com', 'https://app.x');
    expect(emails.length).toBe(0);
  });

  it('token de uso único: não funciona duas vezes', async () => {
    const { service, users, emails } = make();
    await users.create(criarUsuario('a@b.com', 'x'));
    await service.esqueciSenha('a@b.com', 'https://app.x');
    const token = tokenDoLink(emails[0]![2]);
    await service.redefinirSenha(token, 'senha-nova-1');
    await expect(service.redefinirSenha(token, 'outra-senha-2')).rejects.toThrow();
  });

  it('token inválido lança', async () => {
    const { service } = make();
    await expect(service.redefinirSenha('token-que-nao-existe', 'senha123456')).rejects.toThrow();
  });
});
