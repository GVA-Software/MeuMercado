import {
  GeoPoint,
  Mercado,
  Money,
  PriceObservation,
  Produto,
  type Categoria,
  type Unidade,
} from '@meumercado/domain';

export interface SeedData {
  produtos: Produto[];
  mercados: Mercado[];
  observations: PriceObservation[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const PRODUTOS: Array<{
  id: string;
  nome: string;
  categoria: Categoria;
  unidade: Unidade;
  emoji: string;
}> = [
  { id: 'arroz', nome: 'Arroz Branco 5kg', categoria: 'Graos', unidade: 'pacote', emoji: '🌾' },
  { id: 'feijao', nome: 'Feijão Carioca 1kg', categoria: 'Graos', unidade: 'kg', emoji: '🫘' },
  { id: 'oleo', nome: 'Óleo de Soja 900ml', categoria: 'Oleos', unidade: 'ml', emoji: '🫙' },
  { id: 'cafe', nome: 'Café Moído 500g', categoria: 'Bebidas', unidade: 'g', emoji: '☕' },
  { id: 'leite', nome: 'Leite Integral 1L', categoria: 'Laticinios', unidade: 'L', emoji: '🥛' },
  { id: 'ovos', nome: 'Ovos Dúzia', categoria: 'Laticinios', unidade: 'duzia', emoji: '🥚' },
  { id: 'frango', nome: 'Frango Inteiro kg', categoria: 'Carnes', unidade: 'kg', emoji: '🍗' },
  { id: 'banana', nome: 'Banana kg', categoria: 'Frutas', unidade: 'kg', emoji: '🍌' },
];

const MERCADOS: Array<{ id: string; nome: string; rede: string; lat: number; lng: number }> = [
  { id: 'assai', nome: 'Assaí Vila Prudente', rede: 'Assaí', lat: -23.582, lng: -46.58 },
  { id: 'carrefour', nome: 'Carrefour Aricanduva', rede: 'Carrefour', lat: -23.564, lng: -46.51 },
  { id: 'atacadao', nome: 'Atacadão Sapopemba', rede: 'Atacadão', lat: -23.6, lng: -46.52 },
];

/**
 * Preços por produto/mercado. Alguns com "história" para a Nina detectar:
 * café sobe no tempo; arroz mais barato no Atacadão.
 */
const PRECOS: Array<{ produtoId: string; mercadoId: string; reais: number; daysAgo: number }> = [
  // café subindo (12,90 → 14,90) no Assaí
  { produtoId: 'cafe', mercadoId: 'assai', reais: 12.9, daysAgo: 55 },
  { produtoId: 'cafe', mercadoId: 'assai', reais: 13.2, daysAgo: 40 },
  { produtoId: 'cafe', mercadoId: 'assai', reais: 15.5, daysAgo: 12 },
  { produtoId: 'cafe', mercadoId: 'assai', reais: 15.9, daysAgo: 3 },
  { produtoId: 'cafe', mercadoId: 'carrefour', reais: 14.5, daysAgo: 8 },
  // arroz mais barato no Atacadão
  { produtoId: 'arroz', mercadoId: 'assai', reais: 31.5, daysAgo: 10 },
  { produtoId: 'arroz', mercadoId: 'assai', reais: 31.2, daysAgo: 4 },
  { produtoId: 'arroz', mercadoId: 'carrefour', reais: 30.9, daysAgo: 6 },
  { produtoId: 'arroz', mercadoId: 'atacadao', reais: 27.2, daysAgo: 9 },
  { produtoId: 'arroz', mercadoId: 'atacadao', reais: 26.9, daysAgo: 2 },
  // óleo — Carrefour mais barato
  { produtoId: 'oleo', mercadoId: 'assai', reais: 7.9, daysAgo: 7 },
  { produtoId: 'oleo', mercadoId: 'carrefour', reais: 7.2, daysAgo: 5 },
  { produtoId: 'oleo', mercadoId: 'atacadao', reais: 7.6, daysAgo: 6 },
  // leite
  { produtoId: 'leite', mercadoId: 'assai', reais: 6.2, daysAgo: 5 },
  { produtoId: 'leite', mercadoId: 'carrefour', reais: 5.9, daysAgo: 4 },
  // ovos
  { produtoId: 'ovos', mercadoId: 'carrefour', reais: 12.8, daysAgo: 3 },
  { produtoId: 'ovos', mercadoId: 'assai', reais: 13.5, daysAgo: 6 },
  // feijão
  { produtoId: 'feijao', mercadoId: 'assai', reais: 8.5, daysAgo: 5 },
  { produtoId: 'feijao', mercadoId: 'carrefour', reais: 7.9, daysAgo: 4 },
];

/** Monta os dados de demonstração relativos a `now` (padrão: agora). */
export function buildSeed(now: Date = new Date()): SeedData {
  const produtos = PRODUTOS.map((p) => new Produto(p));
  const mercados = MERCADOS.map(
    (m) =>
      new Mercado({
        id: m.id,
        nome: m.nome,
        rede: m.rede,
        localizacao: new GeoPoint(m.lat, m.lng),
      }),
  );
  const observations = PRECOS.map(
    (o, i) =>
      new PriceObservation({
        id: `seed-${i}`,
        produtoId: o.produtoId,
        mercadoId: o.mercadoId,
        price: Money.fromReais(o.reais),
        source: 'manual',
        reporterId: 'seed',
        observedAt: new Date(now.getTime() - o.daysAgo * DAY_MS),
      }),
  );
  return { produtos, mercados, observations };
}
