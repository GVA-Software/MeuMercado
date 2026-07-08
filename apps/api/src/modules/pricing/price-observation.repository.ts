import { Inject, Injectable } from '@nestjs/common';
import { PriceObservation } from '@meumercado/domain';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';

export interface PriceObservationRepository {
  add(obs: PriceObservation): void;
  findByProduto(produtoId: string): PriceObservation[];
  all(): PriceObservation[];
}

export const PRICE_OBSERVATION_REPOSITORY = 'PRICE_OBSERVATION_REPOSITORY';

@Injectable()
export class InMemoryPriceObservationRepository implements PriceObservationRepository {
  private readonly observations: PriceObservation[];

  constructor(@Inject(SEED_DATA) seed: SeedData) {
    this.observations = [...seed.observations];
  }

  add(obs: PriceObservation): void {
    this.observations.push(obs);
  }

  findByProduto(produtoId: string): PriceObservation[] {
    return this.observations.filter((o) => o.produtoId === produtoId);
  }

  all(): PriceObservation[] {
    return this.observations;
  }
}
