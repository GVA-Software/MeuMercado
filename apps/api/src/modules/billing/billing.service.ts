import { Inject, Injectable } from '@nestjs/common';
import { Assinatura, type Periodo } from '@meumercado/domain';
import type { SubscriptionDTO } from '@meumercado/contracts';
import { SUBSCRIPTION_REPOSITORY, type SubscriptionRepository } from './subscription.repository.js';

@Injectable()
export class BillingService {
  constructor(@Inject(SUBSCRIPTION_REPOSITORY) private readonly repo: SubscriptionRepository) {}

  /** Assinatura do usuário (free por padrão, se nunca assinou). */
  forUser(usuarioId: string): Assinatura {
    return this.repo.get(usuarioId) ?? Assinatura.free(usuarioId);
  }

  iniciarTrial(usuarioId: string, agora: Date = new Date()): Assinatura {
    const a = Assinatura.iniciarTrial(usuarioId, agora);
    this.repo.save(a);
    return a;
  }

  /**
   * Ativa o Pro. Numa implementação real, isto é disparado pelo **webhook do
   * gateway** (Mercado Pago/Stripe) após confirmação de pagamento — nunca só
   * pela palavra do cliente.
   */
  assinar(usuarioId: string, periodo: Periodo, agora: Date = new Date()): Assinatura {
    const a = this.forUser(usuarioId).ativar(periodo, agora);
    this.repo.save(a);
    return a;
  }

  cancelar(usuarioId: string): Assinatura {
    const a = this.forUser(usuarioId).cancelar();
    this.repo.save(a);
    return a;
  }

  isProAtivo(usuarioId: string, agora: Date = new Date()): boolean {
    return this.forUser(usuarioId).isProAtivo(agora);
  }

  toDTO(a: Assinatura, agora: Date = new Date()): SubscriptionDTO {
    return {
      ...a.toJSON(),
      isPro: a.isProAtivo(agora),
      diasRestantes: a.diasRestantes(agora),
    };
  }
}
