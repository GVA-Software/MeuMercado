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

  it('mesmo ponto (<70m): o pino do OSM adota os preços do nosso (e o nosso some)', async () => {
    const { svc } = make(
      [nosso({})],
      [osmNode(9, { shop: 'supermarket', name: 'Mesmo Lugar' }, LAT + 0.00013, LNG)], // ~mesmo ponto
    );
    const r = await svc.proximos(LAT, LNG, 2000, 20);
    expect(r.find((m) => m.id === 'nfce:mercado-do-ze')).toBeUndefined();
    expect(r.find((m) => m.id === 'osm-node-9')?.precos).toBe(5);
  });

  it('#4 marca igual: nosso mercado FORA do raio ainda pinta de verde o OSM da marca perto', async () => {
    // Nosso "Atacadão" geocodificou LONGE (~6,6km, fora do raio de 5km); o OSM Atacadão
    // está a ~15m do usuário. Mesmo fora do raio, ele deve casar e pintar o de perto.
    const longe = nosso({
      id: 'nfce:atacadao',
      nome: 'Atacadão',
      lat: LAT + 0.06,
      lng: LNG,
      precos: 186,
    });
    const { svc } = make(
      [longe],
      [osmNode(1, { shop: 'supermarket', name: 'Atacadão' }, LAT + 0.00013, LNG)],
    );
    const r = await svc.proximos(LAT, LNG, 5000, 20);
    expect(r.find((m) => m.id === 'nfce:atacadao')).toBeUndefined(); // pino próprio fora do raio: não aparece
    const osmAtac = r.find((m) => m.id === 'osm-node-1')!;
    expect(osmAtac.precos).toBe(186); // o Atacadão perto ficou verde
    expect(osmAtac.distanciaMetros).toBeLessThan(30);
  });

  it('#4 se o NOSSO já está mais perto que o OSM da marca, mantém o nosso pino', async () => {
    const perto = nosso({
      id: 'nfce:atacadao',
      nome: 'Atacadão',
      lat: LAT + 0.00013,
      lng: LNG,
      precos: 10,
    });
    const { svc } = make(
      [perto],
      [osmNode(1, { shop: 'supermarket', name: 'Atacadão' }, LAT + 0.02, LNG)], // OSM longe
    );
    const r = await svc.proximos(LAT, LNG, 5000, 20);
    expect(r.find((m) => m.id === 'nfce:atacadao')?.precos).toBe(10); // mantém o nosso
    expect(r.find((m) => m.id === 'osm-node-1')?.precos).toBeUndefined(); // OSM longe fica laranja
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

  it('Overpass em paralelo: fica com a resposta MAIS COMPLETA dos endpoints', async () => {
    const { svc } = make([], []);
    const respostas = [
      [osmNode(1, { shop: 'supermarket', name: 'A' }, LAT, LNG)],
      [
        osmNode(1, { shop: 'supermarket', name: 'A' }, LAT, LNG),
        osmNode(2, { shop: 'supermarket', name: 'B' }, LAT + 0.001, LNG),
        osmNode(3, { shop: 'supermarket', name: 'C' }, LAT + 0.002, LNG),
      ],
      [],
    ];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        const els = respostas[call++] ?? [];
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ elements: els })),
        } as unknown as Response);
      }),
    );
    const r = await svc.proximos(LAT, LNG, 3000, 20);
    expect(r.length).toBe(3); // pegou a resposta com 3, não a com 1 nem a vazia
  });

  it('cacheia por área: a 2ª busca no mesmo lugar não refaz o Overpass', async () => {
    const { svc, fetchMock } = make(
      [],
      [osmNode(1, { shop: 'supermarket', name: 'X' }, LAT + 0.00013, LNG)],
    );
    await svc.proximos(LAT, LNG, 2000, 20);
    const apos1 = fetchMock.mock.calls.length;
    await svc.proximos(LAT, LNG, 2000, 20);
    expect(apos1).toBe(3); // 3 endpoints em paralelo na 1ª busca
    expect(fetchMock.mock.calls.length).toBe(apos1); // 2ª veio do cache (sem novo fetch)
  });
});
