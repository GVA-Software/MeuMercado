import { describe, expect, it } from 'vitest';
import { Money, PriceObservation } from '@meumercado/domain';
import { auditarConversa, type ProdutoLite } from './conversation-qa.js';

let seq = 0;
const obs = (produtoId: string, mercadoId: string, cents: number, lat?: number, lng?: number) =>
  new PriceObservation({
    id: `o${seq++}`,
    produtoId,
    mercadoId,
    mercadoNome: mercadoId === 'm1' ? 'Atacadão' : 'Rossi',
    ...(lat !== undefined ? { mercadoLat: lat } : {}),
    ...(lng !== undefined ? { mercadoLng: lng } : {}),
    price: Money.fromCents(cents),
    source: 'manual',
    reporterId: 'u1',
    observedAt: new Date('2026-07-10T12:00:00Z'),
  });

// Catálogo realista: cafés sem acento, um com acento, um óleo com preço.
const CATALOGO: ProdutoLite[] = [
  { id: 'cafe1', nome: 'CAFE 3CORACOES' },
  { id: 'cafe2', nome: 'CAFE MELITTA 500G TRAD' },
  { id: 'cafe3', nome: 'Café Moído 500g' },
  { id: 'oleo', nome: 'OLEO LIZA 900ML SOJA' },
];
const OBS = [
  obs('oleo', 'm1', 658, -23.56, -46.64),
  obs('oleo', 'm2', 675, -23.55, -46.63),
  obs('cafe1', 'm1', 2890),
];

describe('auditarConversa — QA de conversação', () => {
  it('não acusa erros num catálogo saudável', () => {
    const r = auditarConversa(CATALOGO, OBS);
    expect(r.totalProdutos).toBe(4);
    expect(r.comPreco).toBe(2); // oleo + cafe1
    expect(r.erros).toBe(0);
    // busca acha todos (incl. "café" → "CAFE ...")
    expect(r.porLente.find((l) => l.lente === 'busca')!.problemas).toBe(0);
  });

  it('o mais barato aparece primeiro no ranking (sem erro de fluxo)', () => {
    const r = auditarConversa(CATALOGO, OBS);
    expect(r.porLente.find((l) => l.lente === 'fluxo')!.problemas).toBe(0);
    expect(r.erros).toBe(0);
  });

  it('detecta nome com caractere de controle (lente copy)', () => {
    const ruim: ProdutoLite = { id: 'x', nome: `ARROZ${String.fromCharCode(1)}RUIM` };
    const r = auditarConversa([...CATALOGO, ruim], OBS);
    const copy = r.achados.find((a) => a.lente === 'copy' && a.produtoId === 'x');
    expect(copy).toBeDefined();
    expect(r.erros).toBeGreaterThan(0);
  });

  it('não inventa mercado para produto sem preço (cobertura)', () => {
    const r = auditarConversa(CATALOGO, OBS);
    // cafe2 e cafe3 não têm preço → sem mercados, sem erro de cobertura
    expect(r.porLente.find((l) => l.lente === 'cobertura')!.problemas).toBe(0);
    expect(r.semPreco).toBe(2);
  });
});
