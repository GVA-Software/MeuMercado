import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../auth/user.repository.js';
import type { PushService } from '../push/push.service.js';
import type { EmailService } from '../email/email.service.js';
import { InMemoryFeedbackRepository } from './feedback.repository.js';
import { FeedbackService } from './feedback.service.js';

function make() {
  const repo = new InMemoryFeedbackRepository();
  const users = {
    findById: () => Promise.resolve({ id: 'u1', nome: 'Gustavo', email: 'g@x.com' }),
  } as unknown as UserRepository;
  const push = { enviarPara: vi.fn(() => Promise.resolve()) };
  const email = { enviar: vi.fn(() => Promise.resolve()) };
  const service = new FeedbackService(
    repo,
    users,
    push as unknown as PushService,
    email as unknown as EmailService,
  );
  return { service, push, email };
}

describe('FeedbackService', () => {
  it('cria feedback aberto com nome/e-mail do usuário', async () => {
    const { service } = make();
    await service.criar('u1', 'fallback@x.com', { tipo: 'bug', mensagem: 'quebrou X' });
    const r = await service.listar();
    expect(r.abertos).toBe(1);
    expect(r.feedbacks[0]!.usuarioNome).toBe('Gustavo');
    expect(r.feedbacks[0]!.status).toBe('aberto');
  });

  it('responder marca respondido e avisa por push + e-mail', async () => {
    const { service, push, email } = make();
    await service.criar('u1', 'f@x.com', { tipo: 'sugestao', mensagem: 'ideia' });
    const { feedbacks } = await service.listar();
    await service.responder(feedbacks[0]!.id, 'valeu, vamos avaliar!');
    const depois = await service.listar();
    expect(depois.abertos).toBe(0);
    expect(depois.feedbacks[0]!.status).toBe('respondido');
    expect(push.enviarPara).toHaveBeenCalledOnce();
    expect(email.enviar).toHaveBeenCalledOnce();
  });
});
