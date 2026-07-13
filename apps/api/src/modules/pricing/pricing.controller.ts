import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ReportPriceSchema,
  type MercadoResumoDTO,
  type PriceHistoryDTO,
  type PriceSummaryDTO,
  type PriceTableRowDTO,
  type ProdutoParaCompletarDTO,
  type ReportPriceInput,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PricingService } from './pricing.service.js';

@Controller('prices')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  /** Envio colaborativo de preço (manual/QR/foto). Exige usuário autenticado. */
  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  reportar(
    @Body(new ZodValidationPipe(ReportPriceSchema)) body: ReportPriceInput,
    @CurrentUser() user: AuthedUser,
  ): Promise<PriceSummaryDTO> {
    return this.service.reportar(body, user.id);
  }

  /** Tabela de preços colaborativa (produtos com preço reportado). */
  @Get('table')
  tabela(@Query('q') q?: string, @Query('mercado') mercado?: string): Promise<PriceTableRowDTO[]> {
    return this.service.tabela(q, mercado);
  }

  /** Mercados presentes na base (para o filtro da tabela). */
  @Get('mercados')
  mercados(): Promise<MercadoResumoDTO[]> {
    return this.service.mercados();
  }

  /** Produtos que só têm preço em 1 mercado — mutirão "complete a comparação". */
  @Get('para-completar')
  paraCompletar(@Query('limit') limit?: string): Promise<ProdutoParaCompletarDTO[]> {
    const n = Math.min(Math.max(parseInt(limit ?? '', 10) || 30, 1), 100);
    return this.service.paraCompletar(n);
  }

  /** Série histórica de um produto (para o gráfico). */
  @Get(':produtoId/history')
  historico(@Param('produtoId') produtoId: string): Promise<PriceHistoryDTO> {
    return this.service.historico(produtoId);
  }

  /** Resumo (média regional / tendência) de um produto. */
  @Get(':produtoId/summary')
  resumo(@Param('produtoId') produtoId: string): Promise<PriceSummaryDTO> {
    return this.service.resumo(produtoId);
  }
}
