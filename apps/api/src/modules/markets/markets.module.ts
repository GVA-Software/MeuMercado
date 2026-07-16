import { Module } from '@nestjs/common';
import { GeocodeModule } from '../geocode/geocode.module.js';
import { MarketsController } from './markets.controller.js';
import { MarketsService } from './markets.service.js';

@Module({
  imports: [GeocodeModule], // GeocodeService: geocodifica endereço → coord (backfill do mapa)
  controllers: [MarketsController],
  providers: [MarketsService],
})
export class MarketsModule {}
