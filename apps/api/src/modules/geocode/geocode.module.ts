import { Module } from '@nestjs/common';
import { GeocodeController } from './geocode.controller.js';
import { GeocodeService } from './geocode.service.js';

@Module({
  controllers: [GeocodeController],
  providers: [GeocodeService],
  exports: [GeocodeService],
})
export class GeocodeModule {}
