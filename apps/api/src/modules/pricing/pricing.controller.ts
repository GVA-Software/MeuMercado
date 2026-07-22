import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  EstimativaListaSchema,
  ReportPriceSchema,
  type EstimativaListaInput,
  type EstimativaListaResponse,
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

  /**
   * Tabela de preços colaborativa (produtos com preço reportado). `lat`/`lng`
   * (opcionais, em par) fazem a resposta trazer as distâncias — pro app ordenar
   * "perto de mim". Sem eles, as distâncias vêm null (cliente antigo não quebra).
   */
  @Get('table')
  tabela(
    @Query('q') q?: string,
    @Query('mercado') mercado?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ): Promise<PriceTableRowDTO[]> {
    const latN = parseFloat(lat ?? '');
    const lngN = parseFloat(lng ?? '');
    const userPos =
      Number.isFinite(latN) && Number.isFinite(lngN) ? { lat: latN, lng: lngN } : undefined;
    return this.service.tabela(q, mercado, userPos);
  }

  /** Mercados presentes na base (para o filtro da tabela). */
  @Get('mercados')
  mercados(): Promise<MercadoResumoDTO[]> {
    return this.service.mercados();
  }

  /** Prévia do gasto da lista pela média da base (+ produtos sem preço). */
  @Post('estimativa')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  estimativa(
    @Body(new ZodValidationPipe(EstimativaListaSchema)) body: EstimativaListaInput,
  ): Promise<EstimativaListaResponse> {
    return this.service.estimativa(body.itens);
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
