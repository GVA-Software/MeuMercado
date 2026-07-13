import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Assinatura } from '@meumercado/domain';
import type { Env } from '../../config/env.schema.js';
import type { AuthedUser } from '../auth/jwt-auth.guard.js';
import type { StoredUser, UserRepository } from '../auth/user.repository.js';
import type { PushService } from '../push/push.service.js';
import type { AnalyticsRepository } from '../analytics/analytics.repository.js';
import type { PriceObservationRepository } from '../pricing/price-observation.repository.js';
import type { ProdutoRepository } from '../catalog/produtos.repository.js';
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

function makeService(
  usuarios: StoredUser[],
  extra: {
    resumo?: Array<{ name: string; usuarios: number; total: number }>;
    vistos?: string[];
    observacoes?: Array<{ reporterId: string; produtoId?: string; mercadoId?: string }>;
    produtos?: Array<{ id: string; nome: string }>;
    proAtivo?: boolean;
  } = {},
) {
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
  const proAtivo = { isProAtivo: () => true } as unknown as Assinatura;
  const billing = {
    forUser: vi.fn(() => Promise.resolve(extra.proAtivo ? proAtivo : assinatura)),
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
  const analytics = {
    registrar: vi.fn(() => Promise.resolve()),
    resumo: () => Promise.resolve(extra.resumo ?? []),
    usuariosComEvento: () => Promise.resolve(extra.vistos ?? []),
  } as unknown as AnalyticsRepository;
  const prices = {
    all: () => Promise.resolve(extra.observacoes ?? []),
  } as unknown as PriceObservationRepository;
  const produtos = {
    findAll: () => Promise.resolve(extra.produtos ?? []),
    findById: (id: string) =>
      Promise.resolve((extra.produtos ?? []).find((p) => p.id === id) ?? null),
  } as unknown as ProdutoRepository;
  const service = new AdminService(
    users,
    billing as unknown as BillingService,
    push as unknown as PushService,
    config,
    analytics,
    prices,
    produtos,
  );
  return { service, deleted, push, billing };
}

describe('AdminService — guardas de duplicados e trial', () => {
  it('juntarDuplicados rejeita manterId que não existe (evita preços órfãos)', async () => {
    const { service } = makeService([], { produtos: [{ id: 'a', nome: 'A' }] });
    await expect(service.juntarDuplicados('inexistente', ['a'])).rejects.toThrow();
  });

  it('concederTrial rejeita se o usuário já é Pro ativo (não rebaixa)', async () => {
    const { service } = makeService([user('u1', 'u1@x.com')], { proAtivo: true });
    await expect(service.concederTrial('u1')).rejects.toThrow();
  });
});

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

describe('AdminService — QA de conversação', () => {
  it('roda o auditor sobre o catálogo vivo e reporta as lentes', async () => {
    const { service } = makeService([], {
      produtos: [
        { id: 'cafe1', nome: 'CAFE 3CORACOES' },
        { id: 'cafe2', nome: 'CAFE MELITTA 500G TRAD' },
      ],
    });
    const r = await service.qaConversa();
    expect(r.totalProdutos).toBe(2);
    expect(r.porLente.map((l) => l.lente).sort()).toEqual([
      'busca',
      'cobertura',
      'copy',
      'edge',
      'fluxo',
    ]);
    expect(typeof r.geradoEm).toBe('string');
  });
});

describe('AdminService — duplicados', () => {
  it('agrupa produtos com a mesma chave (nome diferente) e ignora únicos', async () => {
    const { service } = makeService([], {
      produtos: [
        { id: 'a', nome: 'PAO PANCO 500G FORMA' },
        { id: 'b', nome: 'PAO FORMA PANCO 500G U' },
        { id: 'c', nome: 'ARROZ CAMIL 5KG' },
      ],
      observacoes: [{ reporterId: 'u1', produtoId: 'a', mercadoId: 'm1' }],
    });
    const { grupos } = await service.duplicados();
    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.produtos.map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(grupos[0]!.produtos.find((p) => p.id === 'a')!.precos).toBe(1);
  });
});

describe('AdminService — funil de ativação', () => {
  it('conta onboarding, registros (sem seed) e a coorte que viu e registrou', async () => {
    const { service } = makeService([user('u1', 'a@a.com'), user('u2', 'b@b.com')], {
      resumo: [
        { name: 'onboarding_visto', usuarios: 2, total: 3 },
        { name: 'onboarding_cta_registrar', usuarios: 1, total: 1 },
      ],
      vistos: ['u1', 'u2'],
      observacoes: [{ reporterId: 'u1' }, { reporterId: 'u1' }, { reporterId: 'seed' }],
    });
    const f = await service.funil();
    expect(f.totalUsuarios).toBe(2);
    expect(f.onboardingVistos).toBe(2);
    expect(f.clicaramRegistrar).toBe(1);
    expect(f.registraramPreco).toBe(1); // u1 distinto; seed excluído
    expect(f.vistosQueRegistraram).toBe(1); // u1 viu E registrou
  });
});
