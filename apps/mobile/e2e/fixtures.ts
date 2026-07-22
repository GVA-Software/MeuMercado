import type { Page, Route } from '@playwright/test';
import { POLITICA_VERSAO } from '@meumercado/contracts';

/**
 * Fixtures + mock da API para os e2e.
 *
 * `installApiMocks` intercepta toda chamada a `/api/**` e responde com dados
 * canônicos. Isso torna o teste determinístico e sem dependências (nem API nem
 * Postgres), focando na fiação do front. Os dados batem de propósito com os
 * recursos que blindamos: tendência de alta e insight da Nina citando preços.
 */

export const USER = {
  id: 'u-e2e',
  email: 'teste@meumercado.app',
  nome: 'Gustavo Teste',
  isAdmin: false,
  temSenha: true,
  fotoUrl: null,
  // Já aceitou a política vigente → o ReconsentGate (modal full-screen) não cobre o app.
  politicaVersao: POLITICA_VERSAO,
};

export const AUTH = { accessToken: 'e2e-access-token', user: USER };

const subBase = { usuarioId: USER.id, status: 'ativa' as const, trialFim: null };
export const SUB_PRO = {
  ...subBase,
  plano: 'pro',
  periodo: 'anual',
  isPro: true,
  diasRestantes: 200,
  periodoFim: '2027-01-01T00:00:00.000Z',
};
export const SUB_FREE = {
  ...subBase,
  plano: 'free',
  periodo: null,
  isPro: false,
  diasRestantes: 0,
  periodoFim: null,
};

/** Carrinho vazio válido — a Home (Compra) lê total/limite/items no boot. */
export const CART = {
  id: 'cart-e2e',
  items: [],
  total: { cents: 0 },
  limite: null,
  mercado: null,
  status: 'sem-limite',
  progressPercent: 0,
  remaining: null,
};

export const PRODUTO = {
  id: 'p-arroz',
  nome: 'ARROZ TIO JOAO 5KG',
  categoria: 'Outros',
  unidade: 'un',
  emoji: '🍚',
};

/** Vários "tipos" para o chat da Nina mostrar as opções ao buscar um termo. */
export const CAFES = [
  { id: 'cafe-pilao', nome: 'CAFE PILAO 500G', categoria: 'Outros', unidade: 'un', emoji: '☕' },
  {
    id: 'cafe-3cor',
    nome: 'CAFE 3 CORACOES 250G',
    categoria: 'Outros',
    unidade: 'un',
    emoji: '☕',
  },
];

/** Linha da tabela com tendência de ALTA — regressão do bug do trend=null. */
export const TABLE_ROW = {
  produto: PRODUTO,
  mediaCents: 2890,
  minCents: 2490,
  maxCents: 3100,
  trend: 'subiu',
  trendPct: 4,
  amostras: 3,
  menorPrecoMercado: 'Atacadao',
  atualizadoEm: '2026-07-10T12:00:00.000Z',
};

/** Insight da Nina citando preços reais (credibilidade da IA). */
export const INSIGHT = {
  type: 'tendencia-alta',
  urgente: true,
  titulo: 'ARROZ TIO JOAO subiu 4%',
  sub: 'Passou de R$ 24,90 para R$ 31,00 no Atacadao. Pode valer a pena estocar agora.',
  emoji: '📈',
};
/** Empurrãozinho proativo (coach) — vira o banner de destaque no topo da Nina.
 *  `produtoId` casa com PRODUTO para o deep-link "registrar preço" achar o item. */
export const COACH = {
  type: 'oportunidade',
  urgente: false,
  produtoId: PRODUTO.id,
  titulo: 'Compare o ARROZ TIO JOAO e economize',
  sub: 'Você só tem 1 preço dele (R$ 28,90). Anote quanto custa em outro mercado e a Nina te diz onde compensa.',
  emoji: '💡',
};
export const INSIGHTS = { insights: [INSIGHT, COACH], geradoEm: '2026-07-11T12:00:00.000Z' };

/** Resposta de "onde eu compro?" — 2 mercados com preço para o produto. */
export const ONDE_COMPRAR = {
  produtoId: PRODUTO.id,
  totalMercados: 2,
  mercados: [
    {
      mercadoId: 'm1',
      mercadoNome: 'Atacadao',
      endereco: 'Av. Teste, 100',
      lat: -23.56,
      lng: -46.64,
      priceCents: 1290,
      distanciaMetros: 1200,
      atualizadoEm: '2026-07-10T12:00:00.000Z',
    },
    {
      mercadoId: 'm2',
      mercadoNome: 'Rossi',
      endereco: null,
      lat: -23.55,
      lng: -46.63,
      priceCents: 1450,
      distanciaMetros: 800,
      atualizadoEm: '2026-07-09T12:00:00.000Z',
    },
  ],
};

export interface MockOpts {
  /** false → /auth/refresh responde 401 (mostra a tela de login). Padrão: true. */
  loggedIn?: boolean;
  /** true → assinatura Pro (Nina liberada). Padrão: true. */
  pro?: boolean;
  /** true (padrão) → marca as boas-vindas como já vistas, pra não cobrir o app.
   *  false → deixa o onboarding aparecer (teste dedicado). */
  onboarded?: boolean;
  /** true → usuário é administrador (destrava recursos de admin). Padrão: false. */
  admin?: boolean;
}

export async function installApiMocks(page: Page, opts: MockOpts = {}): Promise<void> {
  const { loggedIn = true, pro = true, onboarded = true, admin = false } = opts;
  const authUser = { ...USER, isAdmin: admin };
  const auth = { ...AUTH, user: authUser };

  if (onboarded) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('mm-onboarding-v1', '1');
      } catch {
        /* ignora */
      }
    });
  }

  // Predicado exato: só as chamadas da API (`/api/...`). Um glob `**/api/**`
  // pegaria também os módulos do Vite em dev (ex.: `/src/api/client.ts`),
  // devolvendo JSON no lugar do script e quebrando o boot do app.
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route: Route) => {
      const req = route.request();
      const method = req.method();
      const path = new URL(req.url()).pathname;

      // Origem ecoada + credenciais: funciona same-origin e cross-origin.
      const origin = req.headers()['origin'] ?? '*';
      const cors = {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
      };
      const json = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          headers: cors,
          body: JSON.stringify(body),
        });

      if (method === 'OPTIONS') {
        return route.fulfill({
          status: 204,
          headers: {
            ...cors,
            'access-control-allow-headers': 'content-type,authorization',
            'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
          },
        });
      }

      // ---- Auth ----
      if (path.endsWith('/auth/refresh'))
        return loggedIn ? json(auth) : json({ message: 'sem sessão' }, 401);
      if (path.endsWith('/auth/login')) return json(auth);
      if (path.endsWith('/auth/logout')) return json({ ok: true });
      if (path.endsWith('/auth/me')) return json(authUser);

      // ---- Billing ----
      if (path.endsWith('/billing/me')) return json(pro ? SUB_PRO : SUB_FREE);

      // ---- Carrinho ----
      if (path.includes('/carts')) return json(CART);

      // ---- Nina: busca de produto (só com preço) — antes do catálogo genérico ----
      if (path.includes('/insights/produtos')) return json(CAFES);

      // ---- Catálogo ----
      if (path.includes('/produtos/search')) return json(CAFES);
      // Busca por EAN: default "não encontrado" (testes dedicados sobrescrevem).
      // Precisa vir antes do genérico `/produtos` (que devolve array).
      if (path.includes('/produtos/por-ean/'))
        return json({ ean: '00000000', produto: null, sugestaoNome: null });
      if (path.includes('/produtos')) return json([PRODUTO]);

      // ---- Preços ----
      if (path.includes('/prices/table')) return json([TABLE_ROW]);
      if (path.endsWith('/prices/mercados')) return json([{ nome: 'Atacadao', count: 3 }]);
      // Estimativa da lista: default vazio (testes dedicados sobrescrevem).
      if (path.endsWith('/prices/estimativa'))
        return json({ itens: [], totalEstimadoCents: 0, semPreco: [] });
      // Listas salvas: default vazio (testes dedicados sobrescrevem).
      if (path.endsWith('/listas')) return json({ listas: [] });
      // Histórico de compras: default vazio (testes dedicados sobrescrevem).
      if (path.endsWith('/compras')) return json({ compras: [] });
      // Mutirão "complete a comparação": vazio por padrão (testes dedicados
      // sobrescrevem esta rota). Precisa ser ARRAY — o fallback genérico devolve
      // {} e quebraria a tela de Preços.
      if (path.endsWith('/prices/para-completar')) return json([]);

      // ---- Nina ----
      if (path.endsWith('/insights/onde-comprar')) return json(ONDE_COMPRAR);
      if (path.endsWith('/insights')) return json(INSIGHTS);

      // Qualquer outra chamada: resposta benigna (não quebra render).
      return json({});
    },
  );
}
