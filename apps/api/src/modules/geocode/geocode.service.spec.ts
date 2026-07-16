import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodeService } from './geocode.service.js';

/** Captura as queries `q=` que foram ao Nominatim, e controla o que cada uma retorna. */
function stubFetch(hits: (q: string) => boolean) {
  const queries: string[] = [];
  const fetchMock = vi.fn((url: string) => {
    const q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '');
    queries.push(q);
    const achou = hits(q);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(achou ? [{ lat: '-23.5', lon: '-46.6' }] : []),
    } as unknown as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return queries;
}

afterEach(() => vi.restoreAllMocks());

describe('GeocodeService.geocode — parser de endereço', () => {
  it('"Av Alameda ..." vira "Alameda ..." (não "Avenida Alameda")', async () => {
    const queries = stubFetch(() => true);
    await new GeocodeService().geocode('Av ALAMEDA ARAGUAIA, 2879, ALPHAVILLE, BARUERI, SP');
    expect(queries[0]).toMatch(/^alameda araguaia/i);
    expect(queries[0]).not.toMatch(/avenida/i);
  });

  it('remove complemento "letra X"', async () => {
    const queries = stubFetch(() => true);
    await new GeocodeService().geocode(
      'Estrada dos Crisantemos, 196, letra A, Santa Maria, Osasco, SP',
    );
    expect(queries[0]).not.toMatch(/letra/i);
  });

  it('cai para forma mais ampla quando a específica não casa', async () => {
    // Só casa quando a query NÃO tem número (fallback "rua, cidade, uf").
    const queries = stubFetch((q) => !/\d/.test(q));
    const coord = await new GeocodeService().geocode(
      'Avenida dos Autonomistas, 1542, Centro, Osasco, SP',
    );
    expect(coord).toEqual({ lat: -23.5, lng: -46.6 });
    expect(queries.length).toBeGreaterThan(1); // tentou a específica, falhou, e simplificou
    expect(queries[queries.length - 1]).not.toMatch(/1542/);
  });

  it('expande "AV DOS ..." para "Avenida DOS ..."', async () => {
    const queries = stubFetch(() => true);
    await new GeocodeService().geocode('AV DOS AUTONOMISTAS, 1542, CENTRO, OSASCO, SP');
    expect(queries[0]).toMatch(/^Avenida DOS AUTONOMISTAS/);
  });
});
