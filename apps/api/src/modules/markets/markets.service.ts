import { Inject, Injectable, Logger } from '@nestjs/common';
import { GeoPoint } from '@meumercado/domain';
import type { MercadoDTO } from '@meumercado/contracts';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Mercados. "Próximos" busca supermercados REAIS no OpenStreetMap via **Overpass
 * API** (sem API paga) num raio da coordenada do usuário. O seed serve só de
 * fallback/demo para `todos()`.
 */
@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(@Inject(SEED_DATA) private readonly seed: SeedData) {}

  todos(): MercadoDTO[] {
    return this.seed.mercados.map((m) => m.toJSON());
  }

  async proximos(
    lat: number,
    lng: number,
    raioMetros: number,
    limit: number,
  ): Promise<MercadoDTO[]> {
    // Busca TODOS os mercados do raio (sem cortar server-side) — assim os
    // grandes (super/hiper/atacadão) não somem só por haver muita mercearia
    // perto. A ordenação por distância e o corte para `limit` são feitos aqui.
    const query =
      `[out:json][timeout:25];` +
      `(nwr["shop"~"^(supermarket|hypermarket|wholesale|convenience|grocery|greengrocer)$"](around:${raioMetros},${lat},${lng}););` +
      `out center tags 600;`;

    const elements = await this.overpass(query);

    const from = new GeoPoint(lat, lng);
    return elements
      .map((el) => {
        const c = el.type === 'node' ? { lat: el.lat, lon: el.lon } : el.center;
        const nome = el.tags?.name;
        if (!c || c.lat === undefined || c.lon === undefined || !nome) return null;
        const loc = new GeoPoint(c.lat, c.lon);
        return { el, nome, loc, dist: loc.distanceTo(from) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)
      .map(({ el, nome, loc, dist }): MercadoDTO => {
        const t = el.tags ?? {};
        const rede = t.brand ?? t.operator;
        const endereco = this.buildEndereco(t);
        return {
          id: `osm-${el.type}-${el.id}`,
          nome,
          localizacao: loc.toJSON(),
          distanciaMetros: Math.round(dist),
          ...(rede ? { rede } : {}),
          ...(endereco ? { endereco } : {}),
        };
      });
  }

  // Endpoints públicos do Overpass (fallback: o principal costuma sobrecarregar).
  private static readonly OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  private async overpass(query: string): Promise<OverpassElement[]> {
    for (const ep of MarketsService.OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'User-Agent': 'MeuMercado/1.0 (app de compras)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) {
          this.logger.warn(`Overpass ${ep} HTTP ${res.status}`);
          continue;
        }
        const text = await res.text();
        try {
          const data = JSON.parse(text) as { elements?: OverpassElement[] };
          return data.elements ?? [];
        } catch {
          continue; // resposta não-JSON (página de erro) → tenta o próximo
        }
      } catch (e) {
        this.logger.warn(`Overpass ${ep} falhou: ${String(e)}`);
      }
    }
    return [];
  }

  private buildEndereco(t: Record<string, string>): string | undefined {
    const rua = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
    const parts = [rua, t['addr:suburb'] ?? t['addr:neighbourhood'], t['addr:city']].filter(
      Boolean,
    );
    return parts.length > 0 ? parts.join(' - ') : undefined;
  }
}
