import { Controller, Headers, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAdminEmail } from '../common/admin-emails.js';
import type { Env } from '../config/env.schema.js';
import { USER_REPOSITORY, type UserRepository } from '../modules/auth/user.repository.js';
import {
  PRODUTO_REPOSITORY,
  type ProdutoRepository,
} from '../modules/catalog/produtos.repository.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from '../modules/pricing/price-observation.repository.js';
import { PushService } from '../modules/push/push.service.js';
import { auditarConversa } from './conversation-qa.js';

/**
 * QA de conversa no automático: um agendador (GitHub Actions) chama esta rota
 * periodicamente. Roda as 5 lentes sobre a base VIVA e, se achar erros, avisa os
 * admins por push. Protegida por segredo no header (não por JWT).
 */
@Controller('cron')
export class QaCronController {
  constructor(
    @Inject(PRODUTO_REPOSITORY) private readonly produtos: ProdutoRepository,
    @Inject(PRICE_OBSERVATION_REPOSITORY) private readonly prices: PriceObservationRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly push: PushService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('qa')
  @HttpCode(200)
  async qa(
    @Headers('x-cron-secret') secret?: string,
  ): Promise<{ ok: true; erros: number; avisos: number; total: number }> {
    if (secret !== this.config.get('CRON_SECRET', { infer: true })) {
      throw new UnauthorizedException('Segredo de cron inválido');
    }
    const [catalogo, observacoes] = await Promise.all([this.produtos.findAll(), this.prices.all()]);
    const report = auditarConversa(
      catalogo.map((p) => ({ id: p.id, nome: p.nome })),
      observacoes,
    );

    if (report.erros > 0) {
      const csv = this.config.get('ADMIN_EMAILS', { infer: true });
      const admins = (await this.users.findAll()).filter((u) => isAdminEmail(u.email, csv));
      for (const a of admins) {
        await this.push.enviarPara(a.id, {
          title: '⚠️ QA da Nina achou problemas',
          body: `${report.erros} erro(s) em ${report.totalProdutos} produtos. Abra o painel pra ver.`,
          url: '/admin.html',
        });
      }
    }

    return { ok: true, erros: report.erros, avisos: report.avisos, total: report.totalProdutos };
  }
}
