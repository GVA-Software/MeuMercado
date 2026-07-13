import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateFeedbackInput, FeedbackDTO, FeedbacksResponse } from '@meumercado/contracts';
import { USER_REPOSITORY, type UserRepository } from '../auth/user.repository.js';
import { PushService } from '../push/push.service.js';
import { EMAIL_SERVICE, type EmailService } from '../email/email.service.js';
import {
  FEEDBACK_REPOSITORY,
  type Feedback,
  type FeedbackRepository,
} from './feedback.repository.js';

function toDTO(f: Feedback): FeedbackDTO {
  return {
    id: f.id,
    usuarioId: f.usuarioId,
    usuarioNome: f.usuarioNome,
    usuarioEmail: f.usuarioEmail,
    tipo: f.tipo as FeedbackDTO['tipo'],
    mensagem: f.mensagem,
    status: f.status,
    resposta: f.resposta,
    criadoEm: f.criadoEm.toISOString(),
    respondidoEm: f.respondidoEm ? f.respondidoEm.toISOString() : null,
  };
}

@Injectable()
export class FeedbackService {
  constructor(
    @Inject(FEEDBACK_REPOSITORY) private readonly repo: FeedbackRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly push: PushService,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
  ) {}

  async criar(usuarioId: string, emailFallback: string, input: CreateFeedbackInput): Promise<void> {
    const user = await this.users.findById(usuarioId);
    await this.repo.criar({
      id: randomUUID(),
      usuarioId,
      usuarioNome: user?.nome ?? 'Usuário',
      usuarioEmail: user?.email ?? emailFallback,
      tipo: input.tipo,
      mensagem: input.mensagem,
      status: 'aberto',
      resposta: null,
      criadoEm: new Date(),
      respondidoEm: null,
    });
  }

  async listar(): Promise<FeedbacksResponse> {
    const itens = await this.repo.listar();
    return {
      feedbacks: itens.map(toDTO),
      abertos: itens.filter((f) => f.status === 'aberto').length,
    };
  }

  /** Responde e avisa o usuário — push + e-mail (best-effort, não bloqueia). */
  async responder(id: string, resposta: string): Promise<void> {
    const f = await this.repo.obter(id);
    if (!f) throw new NotFoundException('Feedback não encontrado.');
    await this.repo.responder(id, resposta, new Date());
    await this.push.enviarPara(f.usuarioId, {
      title: '💬 Resposta ao seu feedback',
      body: resposta.length > 120 ? `${resposta.slice(0, 117)}…` : resposta,
      url: '/',
    });
    await this.email.enviar(
      f.usuarioEmail,
      'Resposta ao seu feedback — Meu Mercado',
      `Oi, ${f.usuarioNome}!\n\nVocê nos escreveu:\n"${f.mensagem}"\n\nNossa resposta:\n${resposta}\n\n— Equipe Meu Mercado 🧡`,
    );
  }
}
