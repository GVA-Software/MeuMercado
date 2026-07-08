import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import type { ProdutoDTO } from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ProdutosService } from './produtos.service.js';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  listar(): ProdutoDTO[] {
    return this.service.listar();
  }

  @Get('search')
  buscar(
    @Query(new ZodValidationPipe(SearchQuerySchema)) query: z.infer<typeof SearchQuerySchema>,
  ): ProdutoDTO[] {
    return this.service.buscar(query.q, query.limit);
  }

  @Get(':id')
  obter(@Param('id') id: string): ProdutoDTO {
    return this.service.obter(id);
  }
}
