import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller.js';
import { MarketsService } from './markets.service.js';

@Module({
  controllers: [MarketsController],
  providers: [MarketsService],
})
export class MarketsModule {}
