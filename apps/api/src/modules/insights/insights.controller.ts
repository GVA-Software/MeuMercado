import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  OndeComprarSchema,
  type BaseResumoResponse,
  type InsightsResponse,
  type MelhorMercadoResponse,
  type OndeComprarInput,
  type OndeComprarResponse,
  type ProdutoDTO,
  type ReceitasResponse,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ProGuard } from '../billing/pro.guard.js';
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

const MelhorMercadoInputSchema = z.object({
  // Sem `termo` = pergunta GENÉRICA ("qual mercado pra minhas compras?") → base toda.
  termo: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// Nina IA é um recurso Pro: exige login + assinatura ativa (trial ou paga).
@Controller('insights')
@UseGuards(JwtAuthGuard, ProGuard)
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  /** Insights gerais da Nina (tendência, mercado mais barato, mínimo histórico). */
  @Get()
  gerar(): Promise<InsightsResponse> {
    return this.service.gerar();
  }

  /** Inclui a otimização de cesta a partir dos itens enviados. */
  @Post('cesta')
  gerarComCesta(
    @Body(new ZodValidationPipe(BasketSchema)) body: z.infer<typeof BasketSchema>,
  ): Promise<InsightsResponse> {
    return this.service.gerar(body.itens);
  }

  /** Busca de produto da Nina — só produtos que têm preço real (sem placeholders). */
  @Get('produtos')
  buscarProdutos(@Query('q') q?: string): Promise<ProdutoDTO[]> {
    return this.service.buscarComPreco(q ?? '');
  }

  /** Resumo da BASE (contagens + extremos), opcional `?q=` p/ filtrar por categoria. */
  @Get('base')
  baseResumo(@Query('q') q?: string): Promise<BaseResumoResponse> {
    return this.service.baseResumo(q);
  }

  /** Receitas dinâmicas (ensinadas pelo ADM) — a Nina usa no "montar lista". */
  @Get('receitas')
  receitas(): Promise<ReceitasResponse> {
    return this.service.receitas();
  }

  /** "Onde eu compro este produto?" — melhores mercados por preço + distância. */
  @Post('onde-comprar')
  ondeComprar(
    @Body(new ZodValidationPipe(OndeComprarSchema)) body: OndeComprarInput,
  ): Promise<OndeComprarResponse> {
    return this.service.ondeComprar(body.produtoId, body.lat, body.lng);
  }

  /** "Qual o melhor mercado para [categoria]?" — recomenda um mercado. */
  @Post('melhor-mercado')
  melhorMercado(
    @Body(new ZodValidationPipe(MelhorMercadoInputSchema))
    body: z.infer<typeof MelhorMercadoInputSchema>,
  ): Promise<MelhorMercadoResponse> {
    return this.service.melhorMercado(body.termo, body.lat, body.lng);
  }
}
