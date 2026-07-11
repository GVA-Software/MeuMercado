import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  resumirEventos,
  usuariosDistintos,
  type AnalyticsEvent,
  type AnalyticsRepository,
  type EventoResumo,
} from '../../../modules/analytics/analytics.repository.js';
import { AnalyticsEventEntity } from '../entities/analytics-event.entity.js';

/**
 * Persistência dos eventos. A tabela é pequena (eventos de ativação), então as
 * agregações carregam e reduzem em memória — simples e correto nessa escala.
 */
@Injectable()
export class TypeOrmAnalyticsRepository implements AnalyticsRepository {
  constructor(
    @InjectRepository(AnalyticsEventEntity)
    private readonly repo: Repository<AnalyticsEventEntity>,
  ) {}

  async registrar(ev: AnalyticsEvent): Promise<void> {
    await this.repo.insert(ev);
  }

  async resumo(): Promise<EventoResumo[]> {
    return resumirEventos(await this.repo.find());
  }

  async usuariosComEvento(name: string): Promise<string[]> {
    return usuariosDistintos(await this.repo.find({ where: { name } }), name);
  }
}
