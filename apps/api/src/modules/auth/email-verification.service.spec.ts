import { describe, it, expect } from 'vitest';
import { EmailVerificationService } from './email-verification.service.js';
import { InMemoryUserRepository, type StoredUser } from './user.repository.js';
import { InMemoryEmailVerificationRepository } from './email-verification.repository.js';
import type { EmailService } from '../email/email.service.js';

function make(emailLigado = true) {
  const users = new InMemoryUserRepository();
  const verificacoes = new InMemoryEmailVerificationRepository();
  const emails: Array<[string, string, string]> = [];
  const email: EmailService = {
    enviar: (p, a, c) => {
      emails.push([p, a, c]);
      return Promise.resolve();
    },
    estaLigado: () => emailLigado,
    enviarTeste: () => Promise.resolve(),
  };
  const service = new EmailVerificationService(users, verificacoes, email);
  return { service, users, verificacoes, emails };
}

const criarUsuario = (): StoredUser => ({
  id: 'u1',
  email: 'a@b.com',
  nome: 'Ana Paula',
  passwordHash: 'x',
  criadoEm: new Date('2026-07-01T00:00:00Z'),
  emailVerificado: false,
});

const tokenDoLink = (corpo: string): string =>
  /verificar-email=([A-Za-z0-9_-]+)/.exec(corpo)?.[1] ?? '';

describe('EmailVerificationService', () => {
  it('fluxo completo: envia o link → confirma → e-mail verificado', async () => {
    const { service, users, emails } = make();
    await users.create(criarUsuario());

    const enviado = await service.enviarVerificacao('u1', 'https://app.x');
    expect(enviado).toBe(true);
    expect(emails.length).toBe(1);
    expect(emails[0]![0]).toBe('a@b.com');
    const token = tokenDoLink(emails[0]![2]);
    expect(token.length).toBeGreaterThan(10);
    // Ainda pendente até clicar no link.
    expect((await users.findById('u1'))!.emailVerificado).toBe(false);

    await service.confirmar(token);
    expect((await users.findById('u1'))!.emailVerificado).toBe(true);
  });

  it('e-mail desligado: marca como verificado, não manda e-mail e devolve false', async () => {
    const { service, users, emails } = make(false);
    await users.create(criarUsuario());
    const enviado = await service.enviarVerificacao('u1', 'https://app.x');
    expect(enviado).toBe(false);
    expect(emails.length).toBe(0);
    // Sem transporte não há como confirmar → tratado como verificado (não incomoda).
    expect((await users.findById('u1'))!.emailVerificado).toBe(true);
  });

  it('token de uso único: não confirma duas vezes', async () => {
    const { service, users, emails } = make();
    await users.create(criarUsuario());
    await service.enviarVerificacao('u1', 'https://app.x');
    const token = tokenDoLink(emails[0]![2]);
    await service.confirmar(token);
    await expect(service.confirmar(token)).rejects.toThrow();
  });

  it('token inválido lança', async () => {
    const { service } = make();
    await expect(service.confirmar('token-que-nao-existe')).rejects.toThrow();
  });
});
