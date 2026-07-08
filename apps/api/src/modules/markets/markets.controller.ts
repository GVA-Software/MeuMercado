import { Controller, Get, Query } from '@nestjs/common';
import {
  NearbyMarketsQuerySchema,
  type MercadoDTO,
  type NearbyMarketsQuery,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MarketsService } from './markets.service.js';

@Controller('markets')
export class MarketsController {
  constructor(private readonly service: MarketsService) {}

  @Get()
  todos(): MercadoDTO[] {
    return this.service.todos();
  }

  @Get('nearby')
  proximos(
    @Query(new ZodValidationPipe(NearbyMarketsQuerySchema)) q: NearbyMarketsQuery,
  ): MercadoDTO[] {
    return this.service.proximos(q.lat, q.lng, q.raioMetros, q.limit);
  }
}
