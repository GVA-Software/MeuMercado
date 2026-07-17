// Ponto único de exportação do modelo de domínio (POO puro, sem framework).

// Erros
export {
  DomainError,
  InvalidCoordinateError,
  InvalidBoundsError,
  InvalidRouteError,
  InvalidMoneyError,
  CurrencyMismatchError,
  InvalidQuantityError,
  InvalidProductError,
  InvalidMarketError,
  InvalidPriceError,
  InvalidCartError,
  InvalidEmailError,
  InvalidSubscriptionError,
} from './errors.js';

// Identidade / assinatura
export { Email } from './identity/Email.js';
export {
  Assinatura,
  type AssinaturaJSON,
  type Plano,
  type Periodo,
  type StatusAssinatura,
} from './billing/Assinatura.js';

// Dinheiro
export { Money, type Currency, type MoneyJSON } from './money/Money.js';

// Catálogo
export { Produto, type ProdutoJSON, type Unidade } from './catalog/Produto.js';
export { CATEGORIAS, type Categoria, isCategoria } from './catalog/Categoria.js';
export { sugerirCategoria } from './catalog/sugerirCategoria.js';

// Geo (apoio à aba Mapa)
export { GeoPoint, type GeoPointJSON } from './geo/GeoPoint.js';
export { Bounds } from './geo/Bounds.js';

// Mercado
export { Mercado, type MercadoJSON } from './market/Mercado.js';

// Preços (dados colaborativos + estatística)
export {
  PriceObservation,
  type PriceObservationJSON,
  type PriceSource,
} from './pricing/PriceObservation.js';
export { PriceStatistics, type Trend } from './pricing/PriceStatistics.js';

// Carrinho
export { Cart, type BudgetStatus } from './cart/Cart.js';
export { CartItem, type CartItemJSON } from './cart/CartItem.js';

// Nina (insights)
export { Insight, type InsightJSON, type InsightType } from './insights/Insight.js';
export {
  type InsightEngine,
  StatisticalInsightEngine,
  type InsightContext,
  type InsightEngineConfig,
  type ProdutoRef,
  type MercadoRef,
  type BasketLine,
} from './insights/InsightEngine.js';

// Compra assistida ("onde eu compro este produto?")
export {
  melhoresMercadosPara,
  melhorMercadoPara,
  type MercadoRankeado,
  type MercadoAgregado,
} from './shopping/OndeComprar.js';

// Nina — interpretação de intenção da conversa (determinística)
export { interpretar, type Intencao } from './nina/Intent.js';
export { montarLista, type Receita, type ReceitaDef } from './nina/receitas.js';

// Busca tolerante de produtos (acento + abreviação + fuzzy) — compartilhada front/back
export { semAcento, combinaBusca, combinaFuzzy, chaveProduto } from './text/busca.js';
export { aplicarSinonimos } from './text/sinonimos.js';

// Rotas (apoio à aba Mapa — "como chegar" ao mercado)
export { Route } from './routing/Route.js';
export { RouteStep, type ManeuverType } from './routing/RouteStep.js';
