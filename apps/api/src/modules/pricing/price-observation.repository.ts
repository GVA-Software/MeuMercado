import { Inject, Injectable } from '@nestjs/common';
import { PriceObservation } from '@meumercado/domain';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';

/**
 * Porta de acesso às observações de preço (implementação trocável: memória →
 * Postgres). Assíncrona porque a implementação persistente (TypeORM) é async.
 */
export interface PriceObservationRepository {
  add(obs: PriceObservation): Promise<void>;
  findByProduto(produtoId: string): Promise<PriceObservation[]>;
  all(): Promise<PriceObservation[]>;
}

export const PRICE_OBSERVATION_REPOSITORY = 'PRICE_OBSERVATION_REPOSITORY';

/** Implementação em memória (dev local sem banco). Parte do seed de demonstração. */
@Injectable()
export class InMemoryPriceObservationRepository implements PriceObservationRepository {
  private readonly observations: PriceObservation[];

  constructor(@Inject(SEED_DATA) seed: SeedData) {
    this.observations = [...seed.observations];
  }

  add(obs: PriceObservation): Promise<void> {
    this.observations.push(obs);
    return Promise.resolve();
  }

  findByProduto(produtoId: string): Promise<PriceObservation[]> {
    return Promise.resolve(this.observations.filter((o) => o.produtoId === produtoId));
  }

  all(): Promise<PriceObservation[]> {
    return Promise.resolve(this.observations);
  }
}
