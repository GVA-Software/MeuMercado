import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assinatura, type Periodo, type Plano, type StatusAssinatura } from '@meumercado/domain';
import type { SubscriptionRepository } from '../../../modules/billing/subscription.repository.js';
import { SubscriptionEntity } from '../entities/subscription.entity.js';

@Injectable()
export class TypeOrmSubscriptionRepository implements SubscriptionRepository {
  constructor(
    @InjectRepository(SubscriptionEntity) private readonly repo: Repository<SubscriptionEntity>,
  ) {}

  private toDomain(e: SubscriptionEntity): Assinatura {
    return new Assinatura({
      usuarioId: e.usuarioId,
      plano: e.plano as Plano,
      periodo: e.periodo as Periodo | null,
      status: e.status as StatusAssinatura,
      trialFim: e.trialFim,
      periodoFim: e.periodoFim,
    });
  }

  async get(usuarioId: string): Promise<Assinatura | null> {
    const e = await this.repo.findOne({ where: { usuarioId } });
    return e ? this.toDomain(e) : null;
  }

  async todas(): Promise<Assinatura[]> {
    return (await this.repo.find()).map((e) => this.toDomain(e));
  }

  async save(a: Assinatura): Promise<void> {
    const j = a.toJSON();
    await this.repo.save({
      usuarioId: j.usuarioId,
      plano: j.plano,
      periodo: j.periodo,
      status: j.status,
      trialFim: j.trialFim ? new Date(j.trialFim) : null,
      periodoFim: j.periodoFim ? new Date(j.periodoFim) : null,
    });
  }
}
