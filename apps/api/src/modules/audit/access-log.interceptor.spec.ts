import { describe, it, expect } from 'vitest';
import { of, firstValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { AccessLogInterceptor } from './access-log.interceptor.js';
import { InMemoryAccessLogRepository, type AccessLogRepository } from './access-log.repository.js';

interface FakeReq {
  method: string;
  originalUrl: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id?: string };
}

function ctx(req: FakeReq): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const handler: CallHandler = { handle: () => of('ok') };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('AccessLogInterceptor', () => {
  it('registra uma mutação (POST) com autor, IP REAL (req.ip), rota e método', async () => {
    const repo = new InMemoryAccessLogRepository();
    const it = new AccessLogInterceptor(repo);
    const req: FakeReq = {
      method: 'POST',
      originalUrl: '/api/pricing/observations?x=1',
      ip: '203.0.113.9', // IP real (Express já resolveu via trust proxy)
      // cliente TENTA forjar o 1º X-Forwarded-For — deve ser IGNORADO
      headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9', 'user-agent': 'jsdom' },
      user: { id: 'u1' },
    };
    await firstValueFrom(it.intercept(ctx(req), handler));
    await tick();

    const logs = await repo.listarPorUsuario('u1');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      method: 'POST',
      path: '/api/pricing/observations', // sem querystring
      userId: 'u1',
      ip: '203.0.113.9', // req.ip, NÃO o 1.2.3.4 forjado no XFF
      userAgent: 'jsdom',
    });
    expect(logs[0]!.ip).not.toBe('1.2.3.4');
    expect(logs[0]!.criadoEm).toBeInstanceOf(Date);
  });

  it('NÃO registra leitura (GET)', async () => {
    const repo = new InMemoryAccessLogRepository();
    const it = new AccessLogInterceptor(repo);
    const req: FakeReq = {
      method: 'GET',
      originalUrl: '/api/pricing',
      headers: {},
      user: { id: 'u1' },
    };
    await firstValueFrom(it.intercept(ctx(req), handler));
    await tick();
    expect(await repo.listarPorUsuario('u1')).toHaveLength(0);
  });

  it('ignora telemetria pura (/api/events)', async () => {
    const repo = new InMemoryAccessLogRepository();
    const it = new AccessLogInterceptor(repo);
    const req: FakeReq = {
      method: 'POST',
      originalUrl: '/api/events',
      ip: '203.0.113.9',
      headers: {},
      user: { id: 'u1' },
    };
    await firstValueFrom(it.intercept(ctx(req), handler));
    await tick();
    expect(await repo.listarPorUsuario('u1')).toHaveLength(0);
  });

  it('falha ao gravar NÃO derruba a request (best-effort)', async () => {
    const repoQuebrado: AccessLogRepository = {
      registrar: () => Promise.reject(new Error('db down')),
      listarPorUsuario: () => Promise.resolve([]),
    };
    const it = new AccessLogInterceptor(repoQuebrado);
    const req: FakeReq = { method: 'DELETE', originalUrl: '/api/x', headers: {} };
    // a resposta continua fluindo normalmente mesmo com o log falhando
    await expect(firstValueFrom(it.intercept(ctx(req), handler))).resolves.toBe('ok');
    await tick();
  });
});
