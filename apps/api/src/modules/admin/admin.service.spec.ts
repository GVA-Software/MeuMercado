import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Assinatura } from '@meumercado/domain';
import type { Env } from '../../config/env.schema.js';
import type { AuthedUser } from '../auth/jwt-auth.guard.js';
import type { StoredUser, UserRepository } from '../auth/user.repository.js';
import type { PushService } from '../push/push.service.js';
import { BillingService } from '../billing/billing.service.js';
import { AdminService } from './admin.service.js';

const user = (id: string, email: string): StoredUser => ({
  id,
  email,
  nome: 'Fulano',
  passwordHash: 'x',
  criadoEm: new Date('2026-07-01T00:00:00Z'),
});

const ACTING: AuthedUser = { id: 'me', email: 'admin@test.dev' };

function makeService(usuarios: StoredUser[]) {
  const deleted: string[] = [];
  const users: UserRepository = {
    findByEmail: () => Promise.resolve(null),
    findById: (id) => Promise.resolve(usuarios.find((u) => u.id === id) ?? null),
    create: () => Promise.resolve(),
    updateNome: () => Promise.resolve(),
    findAll: () => Promise.resolve(usuarios),
    count: () => Promise.resolve(usuarios.length),
    delete: (id) => {
      deleted.push(id);
      return Promise.resolve();
    },
  };
  const assinatura = Assinatura.free('x');
  const billing = {
    forUser: vi.fn(() => Promise.resolve(assinatura)),
    toDTO: vi.fn(() => ({
      usuarioId: 'x',
      plano: 'free' as const,
      periodo: null,
      status: 'ativa' as const,
      isPro: false,
      diasRestantes: 0,
      trialFim: null,
      periodoFim: null,
    })),
    iniciarTrial: vi.fn(() => Promise.resolve(assinatura)),
    assinar: vi.fn(() => Promise.resolve(assinatura)),
    cancelar: vi.fn(() => Promise.resolve(assinatura)),
  };
  const push = { enviarPara: vi.fn(() => Promise.resolve()) };
  const config = { get: () => 'admin@test.dev' } as unknown as ConfigService<Env, true>;
  const service = new AdminService(
    users,
    billing as unknown as BillingService,
    push as unknown as PushService,
    config,
  );
  return { service, deleted, push, billing };
}

describe('AdminService — proteções de exclusão', () => {
  it('não deixa o admin excluir a si mesmo', async () => {
    const { service } = makeService([user('me', 'admin@test.dev')]);
    await expect(service.excluir('me', ACTING)).rejects.toThrow();
  });

  it('não deixa excluir outro administrador', async () => {
    const { service } = makeService([user('outro', 'admin@test.dev')]);
    await expect(service.excluir('outro', ACTING)).rejects.toThrow();
  });

  it('exclui um usuário comum', async () => {
    const { service, deleted } = makeService([user('joe', 'joe@exemplo.com')]);
    await service.excluir('joe', ACTING);
    expect(deleted).toEqual(['joe']);
  });

  it('erro ao excluir usuário inexistente', async () => {
    const { service } = makeService([]);
    await expect(service.excluir('ninguem', ACTING)).rejects.toThrow();
  });
});

describe('AdminService — conceder plano', () => {
  it('concede teste da Nina e avisa por push', async () => {
    const { service, push, billing } = makeService([user('joe', 'joe@exemplo.com')]);
    await service.concederTrial('joe');
    expect(billing.iniciarTrial).toHaveBeenCalledWith('joe');
    expect(push.enviarPara).toHaveBeenCalledOnce();
  });
});
