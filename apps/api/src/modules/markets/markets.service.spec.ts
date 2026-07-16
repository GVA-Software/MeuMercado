import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketsService } from './markets.service.js';
import type { SeedData } from '../../data/seed.js';
import type {
  MercadoComPreco,
  PriceObservationRepository,
} from '../pricing/price-observation.repository.js';

// Ponto de referência (centro de SP) e um mercado nosso ~15m ao lado.
const LAT = -23.5505;
const LNG = -46.6333;

function make(
  nossos: MercadoComPreco[],
  osmElements: unknown[],
  geo?: { geocode?: (e: string) => Promise<{ lat: number; lng: number } | null> },
) {
  const seed = { mercados: [], observations: [] } as unknown as SeedData;
  const salvos: Array<{ id: string; lat: number; lng: number }> = [];
  const repo = {
    mercadosComPreco: () => Promise.resolve(nossos),
    setMercadoCoords: (id: string, lat: number, lng: number) => {
      salvos.push({ id, lat, lng });
      return Promise.resolve();
    },
  } as unknown as PriceObservationRepository;
  const geocode = {
    geocode: geo?.geocode ?? (() => Promise.resolve(null)),
  } as unknown as import('../geocode/geocode.service.js').GeocodeService;
  const fetchMock = vi.fn((_url: string, _opts?: { body?: string }) =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ elements: osmElements })),
    } as unknown as Response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return { svc: new MarketsService(seed, repo, geocode), fetchMock, salvos };
}

const nosso = (over: Partial<MercadoComPreco>): MercadoComPreco => ({
  id: 'nfce:mercado-do-ze',
  nome: 'Mercado do Zé',
  endereco: 'Rua X, 10',
  lat: LAT + 0.00013, // ~15m
  lng: LNG,
  precos: 5,
  ...over,
});

const osmNode = (id: number, tags: Record<string, string>, lat: number, lng: number) => ({
  type: 'node',
  id,
  lat,
  lon: lng,
  tags,
});

afterEach(() => vi.restoreAllMocks());

describe('MarketsService.proximos', () => {
  it('inclui NOSSO mercado (das NFs) com o selo de preços', async () => {
    const { svc } = make([nosso({})], []);
    const r = await svc.proximos(LAT, LNG, 2000, 20);
    const meu = r.find((m) => m.id === 'nfce:mercado-do-ze')!;
    expect(meu).toBeTruthy();
    expect(meu.precos).toBe(5);
    expect(meu.distanciaMetros).toBeLessThan(30);
  });

  it('mantém mercado do OSM SEM nome (rótulo por tipo) e inclui feira (marketplace)', async () => {
    const { svc } = make(
      [],
      [
        osmNode(1, { shop: 'general' }, LAT + 0.002, LNG), // sem name
        osmNode(2, { amenity: 'marketplace', name: 'Feira do Bairro' }, LAT + 0.0025, LNG),
      ],
    );
    const r = await svc.proximos(LAT, LNG, 2000, 20);
    expect(r.find((m) => m.id === 'osm-node-1')?.nome).toBe('Mercadinho');
    expect(r.find((m) => m.id === 'osm-node-2')?.nome).toBe('Feira do Bairro');
  });

  it('deduplica: OSM no mesmo ponto de um NOSSO é descartado (fica o nosso)', async () => {
    const { svc } = make(
      [nosso({})],
      [osmNode(9, { shop: 'supermarket', name: 'Mesmo Lugar' }, LAT + 0.00013, LNG)], // ~mesmo ponto
    );
    const r = await svc.proximos(LAT, LNG, 2000, 20);
    expect(r.find((m) => m.id === 'osm-node-9')).toBeUndefined();
    expect(r.filter((m) => m.distanciaMetros !== undefined && m.distanciaMetros < 30).length).toBe(
      1,
    );
  });

  it('não inclui NOSSO mercado fora do raio nem sem coordenada', async () => {
    const { svc } = make(
      [
        nosso({ id: 'nfce:longe', lat: -23.7, lng: -46.9 }), // km de distância
        nosso({ id: 'nfce:sem-coord', lat: null, lng: null }),
      ],
      [],
    );
    const r = await svc.proximos(LAT, LNG, 2000, 20);
    expect(r.find((m) => m.id === 'nfce:longe')).toBeUndefined();
    expect(r.find((m) => m.id === 'nfce:sem-coord')).toBeUndefined();
  });

  it('backfill: mercado com endereço mas SEM coord é geocodificado, pina e é salvo', async () => {
    const semCoord = nosso({
      id: 'nfce:atacadao',
      nome: 'Atacadão',
      endereco: 'Av dos Autonomistas, 1542, Osasco, SP',
      lat: null,
      lng: null,
      precos: 200,
    });
    const { svc, salvos } = make([semCoord], [], {
      geocode: () => Promise.resolve({ lat: LAT + 0.0005, lng: LNG }),
    });
    const r = await svc.proximos(LAT, LNG, 2000, 20);
    // Apareceu no mapa (com selo de preços) e a coordenada foi persistida.
    expect(r.find((m) => m.id === 'nfce:atacadao')?.precos).toBe(200);
    expect(salvos).toEqual([{ id: 'nfce:atacadao', lat: LAT + 0.0005, lng: LNG }]);
  });

  it('backfill não pina quem não tem endereço (nada a geocodificar)', async () => {
    const { svc, salvos } = make(
      [nosso({ id: 'nfce:sem-tudo', endereco: null, lat: null, lng: null })],
      [],
    );
    const r = await svc.proximos(LAT, LNG, 2000, 20);
    expect(r.find((m) => m.id === 'nfce:sem-tudo')).toBeUndefined();
    expect(salvos).toEqual([]);
  });

  it('a query do Overpass busca tipos amplos (mercadinho/feira)', async () => {
    const { svc, fetchMock } = make([], []);
    await svc.proximos(LAT, LNG, 2000, 20);
    const body = String((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body).toContain('general');
    expect(body).toContain('marketplace');
  });
});
