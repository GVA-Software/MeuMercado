import { describe, it, expect } from 'vitest';
import { Money, PriceObservation } from '@meumercado/domain';
import { DadosPessoaisService } from './dados-pessoais.service.js';
import { InMemoryUserRepository } from '../auth/user.repository.js';
import { InMemoryCompraRepository } from '../compras/compra.repository.js';
import { InMemoryFeedbackRepository } from '../feedback/feedback.repository.js';
import { InMemorySubscriptionRepository } from '../billing/subscription.repository.js';
import { InMemoryPushSubscriptionRepository } from '../push/push-subscription.repository.js';
import { InMemoryAccessLogRepository } from '../audit/access-log.repository.js';
import type { PriceObservationRepository } from '../pricing/price-observation.repository.js';

function preco(id: string, reporterId: string): PriceObservation {
  return new PriceObservation({
    id,
    produtoId: 'p1',
    mercadoId: 'm1',
    price: Money.fromCents(500),
    source: 'qr',
    reporterId,
    observedAt: new Date('2026-07-01T00:00:00Z'),
    mercadoNome: 'Mercado A',
  });
}

function servico(
  precos: PriceObservationRepository,
  repos: {
    users: InMemoryUserRepository;
    compras: InMemoryCompraRepository;
    feedbacks: InMemoryFeedbackRepository;
    assinaturas: InMemorySubscriptionRepository;
    push: InMemoryPushSubscriptionRepository;
    acessos: InMemoryAccessLogRepository;
  },
) {
  return new DadosPessoaisService(
    repos.users,
    repos.compras,
    precos,
    repos.feedbacks,
    repos.assinaturas,
    repos.push,
    repos.acessos,
  );
}

describe('DadosPessoaisService — exportar (portabilidade LGPD)', () => {
  it('reúne os dados do titular e NÃO vaza os de outro usuário', async () => {
    const repos = {
      users: new InMemoryUserRepository(),
      compras: new InMemoryCompraRepository(),
      feedbacks: new InMemoryFeedbackRepository(),
      assinaturas: new InMemorySubscriptionRepository(),
      push: new InMemoryPushSubscriptionRepository(),
      acessos: new InMemoryAccessLogRepository(),
    };
    // um preço meu (u1) e um de outro reporter — o export só pode conter o meu.
    const precos = {
      all: () => Promise.resolve([preco('o1', 'u1'), preco('o2', 'outro')]),
    } as unknown as PriceObservationRepository;

    await repos.users.create({
      id: 'u1',
      email: 'a@b.com',
      nome: 'A',
      passwordHash: 'x',
      criadoEm: new Date('2026-06-01T00:00:00Z'),
      politicaVersao: '2026-07-17',
    });
    await repos.compras.salvar('u1', {
      id: 'c1',
      mercadoId: null,
      mercadoNome: null,
      mercadoEndereco: null,
      totalCents: 1000,
      economiaCents: 0,
      itens: [],
      criadaEm: new Date().toISOString(),
    });
    await repos.feedbacks.criar({
      id: 'f1',
      usuarioId: 'u1',
      usuarioNome: 'A',
      usuarioEmail: 'a@b.com',
      tipo: 'outro',
      mensagem: 'oi',
      status: 'aberto',
      resposta: null,
      criadoEm: new Date(),
      respondidoEm: null,
    });
    await repos.feedbacks.criar({
      id: 'f2',
      usuarioId: 'outro',
      usuarioNome: 'B',
      usuarioEmail: 'b@b.com',
      tipo: 'outro',
      mensagem: 'segredo-do-outro',
      status: 'aberto',
      resposta: null,
      criadoEm: new Date(),
      respondidoEm: null,
    });
    await repos.push.salvar({
      id: 'p1',
      userId: 'u1',
      endpoint: 'https://push/1',
      p256dh: 'k',
      auth: 'a',
      criadoEm: new Date(),
    });
    await repos.acessos.registrar({
      id: 'l1',
      method: 'POST',
      path: '/api/x',
      userId: 'u1',
      ip: '1.2.3.4',
      userAgent: 'ua',
      criadoEm: new Date(),
    });

    const out = (await servico(precos, repos).exportar('u1')) as Record<string, any>;

    expect(out.titular.id).toBe('u1');
    expect(out.titular.email).toBe('a@b.com');
    expect(out.compras).toHaveLength(1);
    expect(out.precosQueReportei).toHaveLength(1); // só o 'o1' (reporter u1)
    expect(out.precosQueReportei[0].id).toBe('o1');
    expect(out.feedbacks).toHaveLength(1); // só o do u1
    expect(out.feedbacks[0].mensagem).toBe('oi');
    expect(out.notificacoes.dispositivosInscritos).toBe(1);
    expect(out.acessos.total).toBe(1);
    expect(out.assinatura).toBeNull();
    // não vaza NADA de outro usuário
    expect(JSON.stringify(out)).not.toContain('segredo-do-outro');
    expect(JSON.stringify(out)).not.toContain('o2');
  });

  it('rejeita usuário inexistente', async () => {
    const repos = {
      users: new InMemoryUserRepository(),
      compras: new InMemoryCompraRepository(),
      feedbacks: new InMemoryFeedbackRepository(),
      assinaturas: new InMemorySubscriptionRepository(),
      push: new InMemoryPushSubscriptionRepository(),
      acessos: new InMemoryAccessLogRepository(),
    };
    const precos = { all: () => Promise.resolve([]) } as unknown as PriceObservationRepository;
    await expect(servico(precos, repos).exportar('naoexiste')).rejects.toThrow();
  });
});
