import {
  GeoPoint,
  Mercado,
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

const MERCADOS: Array<{
  id: string;
  nome: string;
  rede: string;
  endereco: string;
  lat: number;
  lng: number;
}> = [
  {
    id: 'assai',
    nome: 'Assaí Vila Prudente',
    rede: 'Assaí',
    endereco: 'Av. Prof. Luiz Ignácio Anhaia Mello, 1153 - Vila Prudente, São Paulo - SP',
    lat: -23.582,
    lng: -46.58,
  },
  {
    id: 'carrefour',
    nome: 'Carrefour Aricanduva',
    rede: 'Carrefour',
    endereco: 'Av. Aricanduva, 5555 - Vila Matilde, São Paulo - SP',
    lat: -23.564,
    lng: -46.51,
  },
  {
    id: 'atacadao',
    nome: 'Atacadão Sapopemba',
    rede: 'Atacadão',
    endereco: 'Av. Sapopemba, 9709 - Sapopemba, São Paulo - SP',
    lat: -23.6,
    lng: -46.52,
  },
];

/**
 * Monta os dados relativos a `now` (padrão: agora). O catálogo traz alguns
 * itens básicos como ponto de partida (o usuário adiciona os demais). NENHUM
 * preço é chumbado — os preços são 100% alimentados pelos usuários (manual/NF).
 */
export function buildSeed(_now: Date = new Date()): SeedData {
  const produtos = PRODUTOS.map((p) => new Produto(p));
  const mercados = MERCADOS.map(
    (m) =>
      new Mercado({
        id: m.id,
        nome: m.nome,
        rede: m.rede,
        endereco: m.endereco,
        localizacao: new GeoPoint(m.lat, m.lng),
      }),
  );
  const observations: PriceObservation[] = [];
  return { produtos, mercados, observations };
}
