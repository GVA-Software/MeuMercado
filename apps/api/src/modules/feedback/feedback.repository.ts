import { Injectable } from '@nestjs/common';

export interface Feedback {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioEmail: string;
  tipo: string;
  mensagem: string;
  status: 'aberto' | 'respondido';
  resposta: string | null;
  criadoEm: Date;
  respondidoEm: Date | null;
}

export interface FeedbackRepository {
  criar(f: Feedback): Promise<void>;
  /** Todos os feedbacks, mais recentes primeiro (visão do ADM). */
  listar(): Promise<Feedback[]>;
  obter(id: string): Promise<Feedback | null>;
  responder(id: string, resposta: string, respondidoEm: Date): Promise<void>;
}

export const FEEDBACK_REPOSITORY = 'FEEDBACK_REPOSITORY';

@Injectable()
export class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly itens: Feedback[] = [];

  criar(f: Feedback): Promise<void> {
    this.itens.push(f);
    return Promise.resolve();
  }
  listar(): Promise<Feedback[]> {
    return Promise.resolve(
      [...this.itens].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime()),
    );
  }
  obter(id: string): Promise<Feedback | null> {
    return Promise.resolve(this.itens.find((f) => f.id === id) ?? null);
  }
  responder(id: string, resposta: string, respondidoEm: Date): Promise<void> {
    const f = this.itens.find((x) => x.id === id);
    if (f) {
      f.resposta = resposta;
      f.status = 'respondido';
      f.respondidoEm = respondidoEm;
    }
    return Promise.resolve();
  }
}
