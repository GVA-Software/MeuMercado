import { Injectable } from '@nestjs/common';
import { Assinatura } from '@meumercado/domain';

/** Porta de acesso a assinaturas. Assíncrona (memória ou banco). */
export interface SubscriptionRepository {
  get(usuarioId: string): Promise<Assinatura | null>;
  save(assinatura: Assinatura): Promise<void>;
}

export const SUBSCRIPTION_REPOSITORY = 'SUBSCRIPTION_REPOSITORY';

@Injectable()
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly byUser = new Map<string, Assinatura>();

  get(usuarioId: string): Promise<Assinatura | null> {
    return Promise.resolve(this.byUser.get(usuarioId) ?? null);
  }
  save(assinatura: Assinatura): Promise<void> {
    this.byUser.set(assinatura.usuarioId, assinatura);
    return Promise.resolve();
  }
}
