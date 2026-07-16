import { Inject, Injectable, Logger } from '@nestjs/common';
import { GeoPoint } from '@meumercado/domain';
import type { MercadoDTO } from '@meumercado/contracts';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';
import { GeocodeService } from '../geocode/geocode.service.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type MercadoComPreco,
  type PriceObservationRepository,
} from '../pricing/price-observation.repository.js';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Mercado já resolvido (nosso ou do OSM) antes de virar DTO. */
interface MercadoProximo {
  id: string;
  nome: string;
  loc: GeoPoint;
  dist: number;
  rede?: string;
  endereco?: string;
  precos?: number;
}

// Palavras genéricas (razão social/tipo) que NÃO identificam a marca — removidas antes
// de casar nomes ("CARREFOUR COMERCIO E INDUSTRIA LTDA" ≡ OSM "Carrefour Express").
const RUIDO_NOME = new Set([
  'ltda',
  'me',
  'epp',
  'eireli',
  'sa',
  'cia',
  'comercio',
  'comercial',
  'industria',
  'geral',
  'variedades',
  'supermercado',
  'hipermercado',
  'super',
  'mercado',
  'mercadinho',
  'minimercado',
  'atacadista',
  'atacado',
  'distribuidora',
  'distribuidor',
  'alimentos',
  'filial',
  'matriz',
  'loja',
  'express',
  'mercearia',
  'hortifruti',
  'emporio',
  'armazem',
]);

/** Tokens que identificam a marca (sem acento, minúsculo, ≥3 letras, sem ruído). */
function tokensMercado(nome: string): Set<string> {
  return new Set(
    nome
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !RUIDO_NOME.has(t)),
  );
}

function intersecta(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

/**
 * Mercados. "Próximos" combina DUAS fontes, sem API paga:
 *  1) NOSSA base — mercados que entraram por NFC-e (o preço guarda nome/endereço/
 *     coordenada); assim, mercado que teve nota importada aparece no mapa automaticamente.
 *  2) OpenStreetMap (Overpass) — supermercados/mercadinhos mapeados na região.
 * Os nossos têm prioridade (dado autoritativo + preços) e deduplicam os do OSM que
 * caem no mesmo ponto. O seed serve de fallback/demo para `todos()`.
 */
@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(
    @Inject(SEED_DATA) private readonly seed: SeedData,
    @Inject(PRICE_OBSERVATION_REPOSITORY) private readonly obs: PriceObservationRepository,
    private readonly geocode: GeocodeService,
  ) {}

  // Backfill: no máx. quantos endereços geocodificar por request e orçamento de tempo
  // total (o resto fica pro próximo acesso). É one-time — depois de geocodificado, salvo.
  private static readonly MAX_GEOCODE = 15;
  private static readonly GEOCODE_BUDGET_MS = 8000;

  /**
   * Mercados com preço, garantindo coordenada: os que têm endereço mas entraram sem
   * lat/lng (geocode falhou/pulou na importação) são geocodificados AGORA e a coordenada
   * é salva (backfill). Assim mercado da NF que não pinou passa a pinar — e só uma vez.
   */
  private async mercadosComCoord(): Promise<MercadoComPreco[]> {
    const mercados = await this.obs.mercadosComPreco();
    const semCoord = mercados.filter((m) => (m.lat === null || m.lng === null) && m.endereco);
    const prazo = Date.now() + MarketsService.GEOCODE_BUDGET_MS;
    let feitos = 0;
    for (const m of semCoord) {
      if (feitos >= MarketsService.MAX_GEOCODE || Date.now() > prazo) break;
      feitos++;
      const coord = await this.geocode.geocode(m.endereco!);
      if (coord) {
        m.lat = coord.lat;
        m.lng = coord.lng;
        await this.obs.setMercadoCoords(m.id, coord.lat, coord.lng);
      }
    }
    return mercados;
  }

  // Rótulo em PT quando o mercado no OSM não tem `name` (antes esses eram descartados).
  private static readonly ROTULO_TIPO: Record<string, string> = {
    supermarket: 'Supermercado',
    hypermarket: 'Hipermercado',
    wholesale: 'Atacado',
    convenience: 'Mercado',
    grocery: 'Mercearia',
    greengrocer: 'Hortifruti',
    general: 'Mercadinho',
    marketplace: 'Mercado / Feira',
  };

  async todos(): Promise<MercadoDTO[]> {
    const nossos = (await this.mercadosComCoord())
      .filter((m) => m.lat !== null && m.lng !== null)
      .map((m): MercadoDTO => ({
        id: m.id,
        nome: m.nome ?? 'Mercado',
        localizacao: new GeoPoint(m.lat!, m.lng!).toJSON(),
        ...(m.endereco ? { endereco: m.endereco } : {}),
        precos: m.precos,
      }));
    const ids = new Set(nossos.map((m) => m.id));
    const seedDtos = this.seed.mercados.map((m) => m.toJSON()).filter((m) => !ids.has(m.id));
    return [...nossos, ...seedDtos];
  }

  async proximos(
    lat: number,
    lng: number,
    raioMetros: number,
    limit: number,
  ): Promise<MercadoDTO[]> {
    const from = new GeoPoint(lat, lng);

    // 1) NOSSOS mercados (das NFs) que têm coordenada e estão no raio.
    const nossos: MercadoProximo[] = (await this.mercadosComCoord())
      .filter((m) => m.lat !== null && m.lng !== null)
      .map((m) => {
        const loc = new GeoPoint(m.lat!, m.lng!);
        return {
          id: m.id,
          nome: m.nome ?? 'Mercado',
          loc,
          dist: loc.distanceTo(from),
          precos: m.precos,
          ...(m.endereco ? { endereco: m.endereco } : {}),
        };
      })
      .filter((m) => m.dist <= raioMetros);

    // 2) OpenStreetMap — tipos AMPLOS (inclui mercadinho/feira) e mantendo até os SEM
    // nome (rótulo por tipo), pra não deixar mercado de fora. Ordenação/corte aqui.
    const query =
      `[out:json][timeout:25];` +
      `(nwr["shop"~"^(supermarket|hypermarket|wholesale|convenience|grocery|greengrocer|general)$"](around:${raioMetros},${lat},${lng});` +
      `nwr["amenity"="marketplace"](around:${raioMetros},${lat},${lng}););` +
      `out center tags 600;`;
    const elements = await this.overpass(query);
    const osm: MercadoProximo[] = elements
      .map((el): MercadoProximo | null => {
        const c = el.type === 'node' ? { lat: el.lat, lon: el.lon } : el.center;
        if (!c || c.lat === undefined || c.lon === undefined) return null;
        const t = el.tags ?? {};
        const tipo = t.shop ?? (t.amenity === 'marketplace' ? 'marketplace' : '');
        const nome =
          t.name ?? t.brand ?? t.operator ?? MarketsService.ROTULO_TIPO[tipo] ?? 'Mercado';
        const loc = new GeoPoint(c.lat, c.lon);
        const rede = t.brand ?? t.operator;
        const endereco = this.buildEndereco(t);
        return {
          id: `osm-${el.type}-${el.id}`,
          nome,
          loc,
          dist: loc.distanceTo(from),
          ...(rede ? { rede } : {}),
          ...(endereco ? { endereco } : {}),
        };
      })
      .filter((x): x is MercadoProximo => x !== null);

    // 3) Casa cada NOSSO com o pino REAL do OSM, pra mostrar VERDE no lugar certo mesmo
    //    quando o geocode do endereço caiu longe (na rua/cidade, não na loja):
    //      a) mesmo ponto (<70m): o geocode acertou o pino do OSM → usa o do OSM;
    //      b) mesma marca (nome) e o pino do OSM está MAIS PERTO do usuário que o nosso:
    //         a loja da marca está aqui do lado → pinta ela de verde (e some com o nosso,
    //         que ficou mal posicionado). Se o NOSSO já está mais perto, mantemos o nosso.
    const tok = new Map<MercadoProximo, Set<string>>();
    for (const m of [...nossos, ...osm]) tok.set(m, tokensMercado(`${m.nome} ${m.rede ?? ''}`));
    const consumidos = new Set<string>();
    for (const n of nossos) {
      const tokN = tok.get(n)!;
      let alvo = osm.find((o) => n.loc.distanceTo(o.loc) < 70);
      if (!alvo && tokN.size > 0) {
        alvo = osm
          .filter((o) => o.dist < n.dist && intersecta(tokN, tok.get(o)!))
          .sort((a, b) => a.dist - b.dist)[0];
      }
      if (alvo) {
        alvo.precos = Math.max(alvo.precos ?? 0, n.precos ?? 0);
        consumidos.add(n.id);
      }
    }

    // 4) Une (OSM já com preços onde casou) + nossos não consumidos; ordena e corta.
    return [...osm, ...nossos.filter((n) => !consumidos.has(n.id))]
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)
      .map((m): MercadoDTO => ({
        id: m.id,
        nome: m.nome,
        localizacao: m.loc.toJSON(),
        distanciaMetros: Math.round(m.dist),
        ...(m.rede ? { rede: m.rede } : {}),
        ...(m.endereco ? { endereco: m.endereco } : {}),
        ...(m.precos ? { precos: m.precos } : {}),
      }));
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
