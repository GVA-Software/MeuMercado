import { Injectable } from '@nestjs/common';
import { Assinatura } from '@meumercado/domain';

export interface SubscriptionRepository {
  get(usuarioId: string): Assinatura | null;
  save(assinatura: Assinatura): void;
}

export const SUBSCRIPTION_REPOSITORY = 'SUBSCRIPTION_REPOSITORY';

@Injectable()
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly byUser = new Map<string, Assinatura>();

  get(usuarioId: string): Assinatura | null {
    return this.byUser.get(usuarioId) ?? null;
  }
  save(assinatura: Assinatura): void {
    this.byUser.set(assinatura.usuarioId, assinatura);
  }
}
