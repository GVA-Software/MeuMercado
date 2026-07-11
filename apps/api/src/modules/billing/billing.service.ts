import { Inject, Injectable } from '@nestjs/common';
import { Assinatura, type Periodo } from '@meumercado/domain';
import { PLANOS, type SubscriptionDTO } from '@meumercado/contracts';
import { PushService } from '../push/push.service.js';
import { SUBSCRIPTION_REPOSITORY, type SubscriptionRepository } from './subscription.repository.js';

@Injectable()
export class BillingService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly repo: SubscriptionRepository,
    private readonly push: PushService,
  ) {}

  /** Assinatura do usuário (free por padrão, se nunca assinou). */
  async forUser(usuarioId: string): Promise<Assinatura> {
    return (await this.repo.get(usuarioId)) ?? Assinatura.free(usuarioId);
  }

  /** Se o Pro (trial/pago) acabou de vencer: marca como expirada e avisa por push. */
  private async expirarSeVenceu(a: Assinatura, agora: Date): Promise<Assinatura> {
    if ((a.status !== 'ativa' && a.status !== 'trial') || a.isProAtivo(agora)) return a;
    const expirada = a.expirar();
    await this.repo.save(expirada);
    await this.push.enviarPara(a.usuarioId, {
      title: 'Seu Pro terminou 😢',
      body: `A Nina IA foi bloqueada. Renove por apenas ${PLANOS.mensal.label} e volte a economizar com tudo desbloqueado.`,
      url: '/',
    });
    return expirada;
  }

  /**
   * DTO da assinatura, detectando de forma preguiçosa a EXPIRAÇÃO (abertura do app,
   * via /billing/me). O cron cobre quem não abre o app.
   */
  async minhaComExpiracao(usuarioId: string, agora: Date = new Date()): Promise<SubscriptionDTO> {
    const a = await this.expirarSeVenceu(await this.forUser(usuarioId), agora);
    return this.toDTO(a, agora);
  }

  /** Varredura global (cron): expira e avisa todos que venceram. Retorna quantos. */
  async verificarExpiracoesGlobais(agora: Date = new Date()): Promise<number> {
    const subs = await this.repo.todas();
    let expirados = 0;
    for (const a of subs) {
      const antes = a.status;
      const depois = await this.expirarSeVenceu(a, agora);
      if (depois.status !== antes) expirados += 1;
    }
    return expirados;
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
