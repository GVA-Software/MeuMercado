import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';
import {
  InMemoryPriceObservationRepository,
  PRICE_OBSERVATION_REPOSITORY,
} from './price-observation.repository.js';

@Module({
  controllers: [PricingController],
  providers: [
    PricingService,
    { provide: PRICE_OBSERVATION_REPOSITORY, useClass: InMemoryPriceObservationRepository },
  ],
  exports: [PricingService, PRICE_OBSERVATION_REPOSITORY],
})
export class PricingModule {}
