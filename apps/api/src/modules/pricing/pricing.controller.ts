import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import {
  ReportPriceSchema,
  type PriceSummaryDTO,
  type ReportPriceInput,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PricingService } from './pricing.service.js';

@Controller('prices')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  /** Envio colaborativo de preço (manual/QR/foto). */
  @Post()
  @HttpCode(201)
  reportar(
    @Body(new ZodValidationPipe(ReportPriceSchema)) body: ReportPriceInput,
    // TODO(auth): substituir por id do usuário autenticado (JWT).
    @Headers('x-user-id') reporterId?: string,
  ): PriceSummaryDTO {
    return this.service.reportar(body, reporterId ?? 'anon');
  }

  /** Resumo (média regional / tendência) de um produto. */
  @Get(':produtoId/summary')
  resumo(@Param('produtoId') produtoId: string): PriceSummaryDTO {
    return this.service.resumo(produtoId);
  }
}
