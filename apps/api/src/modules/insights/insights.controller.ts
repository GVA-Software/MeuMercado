import { Body, Controller, Get, Post } from '@nestjs/common';
import { z } from 'zod';
import type { InsightsResponse } from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { InsightsService } from './insights.service.js';

const BasketSchema = z.object({
  itens: z
    .array(
      z.object({
        produtoId: z.string().min(1),
        nome: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .max(200),
});

@Controller('insights')
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  /** Insights gerais da Nina (tendência, mercado mais barato, mínimo histórico). */
  @Get()
  gerar(): InsightsResponse {
    return this.service.gerar();
  }

  /** Inclui a otimização de cesta a partir dos itens enviados. */
  @Post('cesta')
  gerarComCesta(
    @Body(new ZodValidationPipe(BasketSchema)) body: z.infer<typeof BasketSchema>,
  ): InsightsResponse {
    return this.service.gerar(body.itens);
  }
}
