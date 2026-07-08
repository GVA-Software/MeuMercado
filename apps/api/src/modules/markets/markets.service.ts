import { Inject, Injectable } from '@nestjs/common';
import { GeoPoint } from '@meumercado/domain';
import type { MercadoDTO } from '@meumercado/contracts';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';

@Injectable()
export class MarketsService {
  constructor(@Inject(SEED_DATA) private readonly seed: SeedData) {}

  /** Todos os mercados (sem distância). */
  todos(): MercadoDTO[] {
    return this.seed.mercados.map((m) => m.toJSON());
  }

  /** Mercados dentro do raio de um ponto, ordenados por distância. */
  proximos(lat: number, lng: number, raioMetros: number, limit: number): MercadoDTO[] {
    const from = new GeoPoint(lat, lng);
    return this.seed.mercados
      .map((m) => ({ mercado: m, distancia: m.distanceToMeters(from) }))
      .filter((x) => x.distancia <= raioMetros)
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, limit)
      .map(({ mercado, distancia }) => ({
        ...mercado.toJSON(),
        distanciaMetros: Math.round(distancia),
      }));
  }
}
