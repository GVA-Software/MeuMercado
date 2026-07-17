import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY, type UserRepository } from '../auth/user.repository.js';
import { COMPRA_REPOSITORY, type CompraRepository } from '../compras/compra.repository.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from '../pricing/price-observation.repository.js';
import { FEEDBACK_REPOSITORY, type FeedbackRepository } from '../feedback/feedback.repository.js';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from '../billing/subscription.repository.js';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionRepository,
} from '../push/push-subscription.repository.js';
import {
  ACCESS_LOG_REPOSITORY,
  type AccessLogRepository,
} from '../audit/access-log.repository.js';

/**
 * Portabilidade (LGPD art. 18, V) — reúne, num JSON, TODOS os dados que o titular
 * gerou/forneceu. É de leitura: não altera nada. O usuário baixa e leva embora.
 */
@Injectable()
export class DadosPessoaisService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(COMPRA_REPOSITORY) private readonly compras: CompraRepository,
    @Inject(PRICE_OBSERVATION_REPOSITORY) private readonly precos: PriceObservationRepository,
    @Inject(FEEDBACK_REPOSITORY) private readonly feedbacks: FeedbackRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly assinaturas: SubscriptionRepository,
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY) private readonly push: PushSubscriptionRepository,
    @Inject(ACCESS_LOG_REPOSITORY) private readonly acessos: AccessLogRepository,
  ) {}

  async exportar(userId: string): Promise<Record<string, unknown>> {
    const user = await this.users.findById(userId);
    if (!user || user.excluidoEm) throw new NotFoundException('Usuário não encontrado.');
    const agora = new Date();

    const [compras, todosPrecos, todosFeedbacks, assinatura, dispositivos, logs] = await Promise.all(
      [
        this.compras.listarPorUsuario(userId),
        this.precos.all(),
        this.feedbacks.listar(),
        this.assinaturas.get(userId),
        this.push.listarPorUsuario(userId),
        this.acessos.listarPorUsuario(userId, 1000),
      ],
    );

    const meusPrecos = todosPrecos
      .filter((o) => o.reporterId === userId)
      .map((o) => ({
        id: o.id,
        produtoId: o.produtoId,
        mercadoId: o.mercadoId,
        mercadoNome: o.mercadoNome ?? null,
        mercadoEndereco: o.mercadoEndereco ?? null,
        precoCents: o.price.cents,
        origem: o.source,
        dataInformada: o.observedAt.toISOString(),
      }));

    const meusFeedbacks = todosFeedbacks
      .filter((f) => f.usuarioId === userId)
      .map((f) => ({
        tipo: f.tipo,
        mensagem: f.mensagem,
        status: f.status,
        resposta: f.resposta,
        criadoEm: f.criadoEm.toISOString(),
        respondidoEm: f.respondidoEm ? f.respondidoEm.toISOString() : null,
      }));

    return {
      _sobre:
        'Exportação dos seus dados no Meu Mercado (LGPD art. 18, V — portabilidade). ' +
        'Os preços que você cadastrou continuam na base comunitária de forma anônima.',
      geradoEm: agora.toISOString(),
      titular: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        criadoEm: user.criadoEm.toISOString(),
        politicaVersaoAceita: user.politicaVersao ?? null,
      },
      compras,
      precosQueReportei: meusPrecos,
      feedbacks: meusFeedbacks,
      assinatura: assinatura
        ? {
            plano: assinatura.plano,
            status: assinatura.status,
            periodo: assinatura.periodo,
            periodoFim: assinatura.periodoFim ? assinatura.periodoFim.toISOString() : null,
            proAtivo: assinatura.isProAtivo(agora),
          }
        : null,
      notificacoes: { dispositivosInscritos: dispositivos.length },
      acessos: {
        total: logs.length,
        ultimoEm: logs[0] ? logs[0].criadoEm.toISOString() : null,
      },
    };
  }
}
