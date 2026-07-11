import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYTICS_REPOSITORY,
  type AnalyticsRepository,
  type EventoResumo,
} from './analytics.repository.js';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly repo: AnalyticsRepository) {}

  registrar(
    name: string,
    userId: string | null,
    props?: Record<string, string | number | boolean>,
  ): Promise<void> {
    return this.repo.registrar({
      id: randomUUID(),
      name,
      userId,
      props: props ?? null,
      createdAt: new Date(),
    });
  }

  resumo(): Promise<EventoResumo[]> {
    return this.repo.resumo();
  }

  usuariosComEvento(name: string): Promise<string[]> {
    return this.repo.usuariosComEvento(name);
  }
}
