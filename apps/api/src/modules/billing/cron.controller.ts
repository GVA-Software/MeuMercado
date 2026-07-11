import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { BillingService } from './billing.service.js';

/**
 * Rotas de cron (chamadas por um agendador externo — GitHub Actions). Protegidas
 * por um segredo no header, não por JWT. Também servem de "keep-warm" (acordam o
 * servidor free do Render ao serem chamadas).
 */
@Controller('cron')
export class CronController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Expira e avisa (push) todos os planos que venceram. */
  @Post('expiracoes')
  @HttpCode(200)
  async expiracoes(
    @Headers('x-cron-secret') secret?: string,
  ): Promise<{ ok: true; expirados: number }> {
    if (secret !== this.config.get('CRON_SECRET', { infer: true })) {
      throw new UnauthorizedException('Segredo de cron inválido');
    }
    return { ok: true, expirados: await this.billing.verificarExpiracoesGlobais() };
  }
}
