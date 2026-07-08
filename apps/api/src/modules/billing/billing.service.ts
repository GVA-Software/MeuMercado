import { Inject, Injectable } from '@nestjs/common';
import { Assinatura, type Periodo } from '@meumercado/domain';
import type { SubscriptionDTO } from '@meumercado/contracts';
import { SUBSCRIPTION_REPOSITORY, type SubscriptionRepository } from './subscription.repository.js';

@Injectable()
export class BillingService {
  constructor(@Inject(SUBSCRIPTION_REPOSITORY) private readonly repo: SubscriptionRepository) {}

  /** Assinatura do usuário (free por padrão, se nunca assinou). */
  async forUser(usuarioId: string): Promise<Assinatura> {
    return (await this.repo.get(usuarioId)) ?? Assinatura.free(usuarioId);
  }

  async iniciarTrial(usuarioId: string, agora: Date = new Date()): Promise<Assinatura> {
    const a = Assinatura.iniciarTrial(usuarioId, agora);
    await this.repo.save(a);
    return a;
  }

  /**
   * Ativa o Pro. Numa implementação real, isto é disparado pelo **webhook do
   * gateway** (Mercado Pago/Stripe) após confirmação de pagamento — nunca só
   * pela palavra do cliente.
   */
  async assinar(
    usuarioId: string,
    periodo: Periodo,
    agora: Date = new Date(),
  ): Promise<Assinatura> {
    const a = (await this.forUser(usuarioId)).ativar(periodo, agora);
    await this.repo.save(a);
    return a;
  }

  async cancelar(usuarioId: string): Promise<Assinatura> {
    const a = (await this.forUser(usuarioId)).cancelar();
    await this.repo.save(a);
    return a;
  }

  async isProAtivo(usuarioId: string, agora: Date = new Date()): Promise<boolean> {
    return (await this.forUser(usuarioId)).isProAtivo(agora);
  }

  toDTO(a: Assinatura, agora: Date = new Date()): SubscriptionDTO {
    return {
      ...a.toJSON(),
      isPro: a.isProAtivo(agora),
      diasRestantes: a.diasRestantes(agora),
    };
  }
}
