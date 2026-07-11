import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Assinatura } from '@meumercado/domain';
import type { SubscriptionRepository } from './subscription.repository.js';
import type { PushService } from '../push/push.service.js';
import { BillingService } from './billing.service.js';

const AGORA = new Date('2026-07-11T12:00:00Z');
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);
const diasFrente = (n: number) => new Date(AGORA.getTime() + n * 86_400_000);

const proVencido = (usuarioId: string) =>
  new Assinatura({
    usuarioId,
    plano: 'pro',
    periodo: 'mensal',
    status: 'ativa',
    periodoFim: diasAtras(1),
  });
const proVigente = (usuarioId: string) =>
  new Assinatura({
    usuarioId,
    plano: 'pro',
    periodo: 'mensal',
    status: 'ativa',
    periodoFim: diasFrente(10),
  });

function makeService(subs: Assinatura[]) {
  const saved: Assinatura[] = [];
  const repo: SubscriptionRepository = {
    get: (id) => Promise.resolve(subs.find((s) => s.usuarioId === id) ?? null),
    save: (a) => {
      saved.push(a);
      return Promise.resolve();
    },
    todas: () => Promise.resolve(subs),
  };
  const push = { enviarPara: vi.fn(() => Promise.resolve()) };
  const service = new BillingService(repo, push as unknown as PushService);
  return { service, saved, push };
}

describe('BillingService — expiração', () => {
  it('marca como expirada e avisa por push quando o Pro venceu', async () => {
    const { service, saved, push } = makeService([proVencido('u1')]);
    const dto = await service.minhaComExpiracao('u1', AGORA);
    expect(dto.status).toBe('expirada');
    expect(dto.isPro).toBe(false);
    expect(saved.at(-1)?.status).toBe('expirada');
    expect(push.enviarPara).toHaveBeenCalledOnce();
  });

  it('não faz nada quando o Pro ainda está vigente', async () => {
    const { service, saved, push } = makeService([proVigente('u1')]);
    const dto = await service.minhaComExpiracao('u1', AGORA);
    expect(dto.status).toBe('ativa');
    expect(dto.isPro).toBe(true);
    expect(saved).toHaveLength(0);
    expect(push.enviarPara).not.toHaveBeenCalled();
  });

  it('varredura global conta só os que venceram', async () => {
    const { service, push } = makeService([proVencido('u1'), proVigente('u2'), proVencido('u3')]);
    const n = await service.verificarExpiracoesGlobais(AGORA);
    expect(n).toBe(2);
    expect(push.enviarPara).toHaveBeenCalledTimes(2);
  });

  it('usuário sem assinatura é Free por padrão', async () => {
    const { service } = makeService([]);
    const a = await service.forUser('novo');
    expect(a.plano).toBe('free');
  });
});
