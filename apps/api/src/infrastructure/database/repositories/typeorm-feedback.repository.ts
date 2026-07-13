import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  Feedback,
  FeedbackRepository,
} from '../../../modules/feedback/feedback.repository.js';
import { FeedbackEntity } from '../entities/feedback.entity.js';

@Injectable()
export class TypeOrmFeedbackRepository implements FeedbackRepository {
  constructor(
    @InjectRepository(FeedbackEntity) private readonly repo: Repository<FeedbackEntity>,
  ) {}

  async criar(f: Feedback): Promise<void> {
    await this.repo.insert(f);
  }

  async listar(): Promise<Feedback[]> {
    const rows = await this.repo.find({ order: { criadoEm: 'DESC' } });
    return rows.map((r) => ({
      id: r.id,
      usuarioId: r.usuarioId,
      usuarioNome: r.usuarioNome,
      usuarioEmail: r.usuarioEmail,
      tipo: r.tipo,
      mensagem: r.mensagem,
      status: r.status === 'respondido' ? 'respondido' : 'aberto',
      resposta: r.resposta,
      criadoEm: r.criadoEm,
      respondidoEm: r.respondidoEm,
    }));
  }

  async obter(id: string): Promise<Feedback | null> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      usuarioId: r.usuarioId,
      usuarioNome: r.usuarioNome,
      usuarioEmail: r.usuarioEmail,
      tipo: r.tipo,
      mensagem: r.mensagem,
      status: r.status === 'respondido' ? 'respondido' : 'aberto',
      resposta: r.resposta,
      criadoEm: r.criadoEm,
      respondidoEm: r.respondidoEm,
    };
  }

  async responder(id: string, resposta: string, respondidoEm: Date): Promise<void> {
    await this.repo.update({ id }, { resposta, status: 'respondido', respondidoEm });
  }
}
