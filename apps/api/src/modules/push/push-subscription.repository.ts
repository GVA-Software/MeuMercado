import { Injectable } from '@nestjs/common';

/** Uma inscrição de push (Web Push) de um dispositivo do usuário. */
export interface PushSub {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  criadoEm: Date;
}

export interface PushSubscriptionRepository {
  /** Cria ou atualiza a inscrição (chave: endpoint). */
  salvar(sub: PushSub): Promise<void>;
  listarPorUsuario(userId: string): Promise<PushSub[]>;
  removerPorEndpoint(endpoint: string): Promise<void>;
}

export const PUSH_SUBSCRIPTION_REPOSITORY = 'PUSH_SUBSCRIPTION_REPOSITORY';

@Injectable()
export class InMemoryPushSubscriptionRepository implements PushSubscriptionRepository {
  private readonly porEndpoint = new Map<string, PushSub>();

  salvar(sub: PushSub): Promise<void> {
    this.porEndpoint.set(sub.endpoint, sub);
    return Promise.resolve();
  }
  listarPorUsuario(userId: string): Promise<PushSub[]> {
    return Promise.resolve([...this.porEndpoint.values()].filter((s) => s.userId === userId));
  }
  removerPorEndpoint(endpoint: string): Promise<void> {
    this.porEndpoint.delete(endpoint);
    return Promise.resolve();
  }
}
