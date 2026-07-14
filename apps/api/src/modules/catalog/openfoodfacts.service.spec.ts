import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenFoodFactsService } from './openfoodfacts.service.js';

function resposta(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

afterEach(() => vi.unstubAllGlobals());

describe('OpenFoodFactsService', () => {
  it('monta nome + tamanho quando o produto existe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        resposta({
          status: 1,
          product: { product_name: 'Leite Condensado Moça', quantity: '395 g' },
        }),
      ),
    );
    const svc = new OpenFoodFactsService();
    expect(await svc.nomePorEan('7891000315507')).toBe('Leite Condensado Moça 395 g');
  });

  it('não duplica o tamanho se já vier no nome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        resposta({ status: 1, product: { product_name_pt: 'Café Pilão 500g', quantity: '500g' } }),
      ),
    );
    const svc = new OpenFoodFactsService();
    expect(await svc.nomePorEan('7896089012345')).toBe('Café Pilão 500g');
  });

  it('status !== 1 → null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => resposta({ status: 0 })),
    );
    expect(await new OpenFoodFactsService().nomePorEan('0000000000000')).toBeNull();
  });

  it('erro/timeout de rede → null (best-effort, não lança)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('timeout'))),
    );
    expect(await new OpenFoodFactsService().nomePorEan('7891000315507')).toBeNull();
  });

  it('cacheia: 2ª busca do mesmo EAN não refaz o fetch', async () => {
    const fetchMock = vi.fn(() => resposta({ status: 1, product: { product_name: 'X' } }));
    vi.stubGlobal('fetch', fetchMock);
    const svc = new OpenFoodFactsService();
    await svc.nomePorEan('7891000315507');
    await svc.nomePorEan('7891000315507');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
