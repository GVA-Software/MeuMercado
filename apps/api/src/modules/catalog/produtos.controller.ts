import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  CreateProdutoSchema,
  type CreateProdutoInput,
  type ProdutoDTO,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminGuard } from '../admin/admin.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ProdutosService } from './produtos.service.js';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const MergeSchema = z.object({ intoId: z.string().min(1).max(128) });

@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  listar(): Promise<ProdutoDTO[]> {
    return this.service.listar();
  }

  @Get('search')
  buscar(
    @Query(new ZodValidationPipe(SearchQuerySchema)) query: z.infer<typeof SearchQuerySchema>,
  ): Promise<ProdutoDTO[]> {
    return this.service.buscar(query.q, query.limit);
  }

  /** Cria um produto no catálogo (catálogo aberto). Exige usuário autenticado. */
  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  criar(
    @Body(new ZodValidationPipe(CreateProdutoSchema)) body: CreateProdutoInput,
  ): Promise<ProdutoDTO> {
    return this.service.criar(body);
  }

  /** Junta um produto duplicado em outro (move os preços). Só administradores. */
  @Post(':id/merge')
  @UseGuards(JwtAuthGuard, AdminGuard)
  merge(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MergeSchema)) body: z.infer<typeof MergeSchema>,
  ): Promise<ProdutoDTO> {
    return this.service.merge(id, body.intoId);
  }

  @Get(':id')
  obter(@Param('id') id: string): Promise<ProdutoDTO> {
    return this.service.obter(id);
  }
}
