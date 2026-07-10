import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  PushSub,
  PushSubscriptionRepository,
} from '../../../modules/push/push-subscription.repository.js';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity.js';

@Injectable()
export class TypeOrmPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repo: Repository<PushSubscriptionEntity>,
  ) {}

  async salvar(sub: PushSub): Promise<void> {
    // upsert por endpoint (chave única): novo dispositivo cria, mesmo endpoint atualiza.
    await this.repo.upsert(sub, ['endpoint']);
  }

  listarPorUsuario(userId: string): Promise<PushSub[]> {
    return this.repo.find({ where: { userId } });
  }

  async removerPorEndpoint(endpoint: string): Promise<void> {
    await this.repo.delete({ endpoint });
  }
}
