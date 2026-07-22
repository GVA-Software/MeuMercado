import { test, expect } from '@playwright/test';
import { installApiMocks, AUTH } from './fixtures';

/**
 * Jornada crítica do usuário, ponta a ponta:
 *   entrar → ver a tabela de preços (tendência) → Nina (liberada e bloqueada).
 * Fecha a pirâmide de testes na camada de UI, cobrindo os recursos que blindamos.
 */
test.describe('Meu Mercado — jornada crítica', () => {
  test('onboarding: primeira abertura mostra o valor da base e leva ao registro', async ({
    page,
  }) => {
    await installApiMocks(page, { onboarded: false });
    await page.goto('/');

    await expect(page.getByText(/Bem-vindo/)).toBeVisible();
    await expect(page.getByText('mercados')).toBeVisible(); // números da comunidade

    await page.getByRole('button', { name: /Registrar meu primeiro preço/ }).click();
    await expect(page.getByText(/Ajude a comunidade/)).toBeVisible(); // registro aberto
  });

  test('login: entra com e-mail/senha e passa do portão', async ({ page }) => {
    await installApiMocks(page, { loggedIn: false }); // refresh 401 → tela de login
    await page.goto('/');

    await page.getByPlaceholder('E-mail').fill('teste@meumercado.app');
    await page.getByPlaceholder('Senha', { exact: true }).fill('senha-de-teste');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // A navegação inferior só existe logado → confirma que passamos do portão.
    await expect(page.getByRole('button', { name: /Nina IA/ })).toBeVisible();
  });

  test('cold start: servidor frio mostra "acordando" e NÃO cai no login', async ({ page }) => {
    // Regressão: no cold start do Render o /auth/refresh falha (5xx/rede) por uns
    // segundos. Isso NÃO pode deslogar o usuário — deve mostrar a NOSSA tela de
    // "acordando" e recuperar sozinho quando o servidor sobe.
    await installApiMocks(page); // logado + Pro
    let refreshCalls = 0;
    // Sobrepõe /auth/refresh: as 2 primeiras respostas simulam o Render frio (503),
    // depois "acorda". Registrado depois → tem prioridade sobre o mock base.
    await page.route(
      (url) => url.pathname.endsWith('/auth/refresh'),
      (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        refreshCalls++;
        if (refreshCalls <= 2) {
          return route.fulfill({
            status: 503,
            contentType: 'text/html',
            body: 'Service waking up',
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': route.request().headers()['origin'] ?? '*',
            'access-control-allow-credentials': 'true',
          },
          body: JSON.stringify(AUTH),
        });
      },
    );
    await page.goto('/');

    // Enquanto o servidor está frio: a nossa tela de "acordando", NUNCA o login.
    await expect(page.getByText(/Acordando o servidor/i)).toBeVisible();
    await expect(page.getByPlaceholder('E-mail')).toHaveCount(0);

    // Recupera sozinho quando o servidor sobe: o app carrega (nav inferior aparece).
    await expect(page.getByRole('button', { name: /Nina IA/ })).toBeVisible({ timeout: 15000 });
    expect(refreshCalls).toBeGreaterThanOrEqual(3);
  });

  test('Preços: exibe a tendência de alta (regressão do trend)', async ({ page }) => {
    await installApiMocks(page); // logado + Pro
    await page.goto('/');

    await page.getByRole('button', { name: /Preços/ }).click();

    await expect(page.getByText('ARROZ TIO JOAO 5KG')).toBeVisible();
    await expect(page.getByText(/\+4%/)).toBeVisible(); // badge ▲ +4%
  });

  test('Nina (Pro): "Meus alertas" traz os insights citando preços reais', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();
    // Os insights viram um botão — a Nina só os mostra ao pedir.
    await page.getByRole('button', { name: /Meus alertas/ }).click();

    await expect(page.getByText('Compare o ARROZ TIO JOAO e economize')).toBeVisible();
    await expect(page.getByText('ARROZ TIO JOAO subiu 4%')).toBeVisible();
    await expect(page.getByText(/Passou de R\$ 24,90 para R\$ 31,00/)).toBeVisible();
  });

  test('loop de cobertura: registrar pelo alerta abre o registro do produto', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();
    await page.getByRole('button', { name: /Meus alertas/ }).click();
    // O card do empurrãozinho tem o botão de registrar → deep-link pros Preços.
    await page
      .getByRole('button', { name: /Registrar preço/ })
      .first()
      .click();

    await expect(page.getByText(/Ajude a comunidade/)).toBeVisible();
    await expect(page.getByText('trocar')).toBeVisible(); // produto já selecionado
  });

  test('Nina "onde compro" (chat): termo → tipos → mercados ranqueados', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: -23.55, longitude: -46.63 });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();

    // Bate-papo: escreve o termo → Nina mostra TODOS os tipos.
    const composer = page.getByPlaceholder('Ex.: café, arroz, sabão…');
    await composer.fill('café');
    await composer.press('Enter');
    await expect(page.getByText(/Achei 2 tipos/)).toBeVisible();

    // Escolhe um tipo → mercados ranqueados (mais barato primeiro).
    // O nome é exibido BONITO (marcaMercado: "Atacadao" → "Atacadão").
    await page.getByRole('button', { name: /CAFE PILAO 500G/ }).click();
    await expect(page.getByText('Atacadão', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/12,90/).first()).toBeVisible(); // resumo + cartão
    await expect(page.getByText('Rossi', { exact: true }).first()).toBeVisible();
  });

  test('Nina: "qual o melhor mercado para [X]" recomenda um mercado', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: -23.55, longitude: -46.63 });
    await page.route(
      (url) => url.pathname.endsWith('/insights/melhor-mercado'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            termo: 'limpeza',
            totalProdutos: 3,
            mercados: [
              {
                mercadoId: 'm1',
                mercadoNome: 'Atacadao',
                endereco: null,
                lat: null,
                lng: null,
                distanciaMetros: null,
                produtosComPreco: 3,
                vitorias: 3,
              },
            ],
          }),
        }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: /Nina IA/ }).click();
    const composer = page.getByPlaceholder('Ex.: café, arroz, sabão…');
    await composer.fill('qual o melhor mercado para produtos de limpeza');
    await composer.press('Enter');

    // Recomenda um mercado com o nome BONITO (Atacadao -> Atacadão), sem ecoar o termo.
    await expect(page.getByText(/iria de Atacadão/)).toBeVisible();
  });

  test('Nina entende agradecimento e responde com tom acolhedor', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();
    const composer = page.getByPlaceholder('Ex.: café, arroz, sabão…');
    await composer.fill('obrigado');
    await composer.press('Enter');

    // Não trata "obrigado" como produto — responde acolhedor.
    await expect(page.getByText(/Imagina/)).toBeVisible();
  });

  test('navegação: trocar de aba troca a tela e NÃO empilha (regressão iOS/Safari)', async ({
    page,
  }) => {
    await installApiMocks(page, { pro: true });
    await page.goto('/');

    // Home (Compra) carregada e UM único container de tela.
    await expect(page.getByText(/Boa tarde|Bom dia|Boa noite/)).toBeVisible();
    const containers = page.locator('.app-scroll');
    await expect(containers).toHaveCount(1);

    // O bug do WebKit: cada troca ADICIONAVA um `.app-scroll` (2, 3, 4…) sem
    // remover o anterior — o Compra, com height:100%, tapava as telas de baixo.
    // Aqui exigimos: sempre 1 container, e o conteúdo é o da aba nova.
    await page.getByRole('button', { name: /Preços/ }).click();
    await expect(page.getByText('ARROZ TIO JOAO 5KG')).toBeVisible();
    await expect(containers).toHaveCount(1);
    await expect(page.getByText('Carrinho atual')).toHaveCount(0); // Compra saiu

    await page.getByRole('button', { name: /Perfil/ }).click();
    await expect(containers).toHaveCount(1);
    await expect(page.getByText('ARROZ TIO JOAO 5KG')).toHaveCount(0); // Preços saiu

    await page.getByRole('button', { name: /Nina IA/ }).click();
    await expect(containers).toHaveCount(1);

    // Volta pro Compra: o container continua único e o Compra reaparece.
    await page.getByRole('button', { name: /Compra/ }).click();
    await expect(page.getByText('Carrinho atual')).toBeVisible();
    await expect(containers).toHaveCount(1);
  });

  test('bipar produto no Adicionar item preenche o nome (via digitar código)', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    // Busca por EAN → produto conhecido no catálogo.
    await page.route(
      (url) => url.pathname.includes('/produtos/por-ean/'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            ean: '7891000315507',
            produto: {
              id: 'p-leite',
              nome: 'LEITE MOÇA 395G',
              categoria: 'Outros',
              unidade: 'un',
              ean: '7891000315507',
            },
            sugestaoNome: null,
          }),
        }),
    );
    await page.goto('/');

    // Abre "Adicionar item" (+ no header) → abre o scanner (📷).
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.getByTitle('Bipar o código de barras').click();

    // Sem câmera no teste: usa o fallback "digitar o código".
    await page.getByPlaceholder(/7891000315507/).fill('7891000315507');
    await page.getByRole('button', { name: 'Usar' }).click();

    // Produto veio preenchido: o campo mostra o nome e já dá pra adicionar à lista.
    await expect(page.getByPlaceholder('Buscar produto…')).toHaveValue('LEITE MOÇA 395G');
    await expect(page.getByRole('button', { name: /Adicionar à lista/ })).toBeVisible();
  });

  test('bipar produto NOVO cai direto no preço (auto-cadastra, sem passo extra)', async ({
    page,
  }) => {
    await installApiMocks(page, { pro: true });
    // EAN novo: não está na base, mas o OFF sugere um nome.
    await page.route(
      (url) => url.pathname.includes('/produtos/por-ean/'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            ean: '7891000315507',
            produto: null,
            sugestaoNome: 'Leite Shefa Integral 1 L',
          }),
        }),
    );
    // POST /produtos (auto-cadastro) devolve o produto criado; GET cai no fallback.
    await page.route(
      (url) => url.pathname.endsWith('/produtos'),
      (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            id: 'p-novo',
            nome: 'Leite Shefa Integral 1 L',
            categoria: 'Outros',
            unidade: 'un',
            ean: '7891000315507',
          }),
        });
      },
    );
    await page.goto('/');

    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.getByTitle('Bipar o código de barras').click();
    await page.getByPlaceholder(/7891000315507/).fill('7891000315507');
    await page.getByRole('button', { name: 'Usar' }).click();

    // Cai DIRETO na quantidade com o nome preenchido — sem passo "Criar".
    await expect(page.getByPlaceholder('Buscar produto…')).toHaveValue('Leite Shefa Integral 1 L');
    await expect(page.getByRole('button', { name: /Adicionar à lista/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Criar/ })).toHaveCount(0);
  });

  test('Preços: leitor de código de barras só aparece para admin', async ({ page }) => {
    await installApiMocks(page); // usuário comum (isAdmin: false)
    await page.goto('/');
    await page.getByRole('button', { name: /Preços/ }).click();
    await page
      .getByRole('button', { name: /Registrar preço/ })
      .first()
      .click();
    // Sheet abriu (subtítulo único) → mas SEM o 📷 para não-admin.
    await expect(page.getByText(/Ajude a comunidade: quanto custou e onde/)).toBeVisible();
    await expect(page.getByTitle('Bipar o código de barras')).toHaveCount(0);
  });

  test('Preços: admin VÊ o leitor de código de barras no Registrar preço', async ({ page }) => {
    await installApiMocks(page, { admin: true });
    await page.goto('/');
    await page.getByRole('button', { name: /Preços/ }).click();
    await page
      .getByRole('button', { name: /Registrar preço/ })
      .first()
      .click();
    await expect(page.getByTitle('Bipar o código de barras')).toBeVisible();
  });

  test('Nina (Free): mostra o paywall em vez dos insights', async ({ page }) => {
    await installApiMocks(page, { pro: false });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();

    await expect(page.getByText('A Nina IA é um recurso Pro')).toBeVisible();
  });

  test('Lista de compras: planejar → riscar EXIGE mercado → check-in → preço alimenta a base', async ({
    page,
  }) => {
    await installApiMocks(page, { pro: true });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: -23.55, longitude: -46.63 });

    // Mercado por perto (check-in por GPS).
    await page.route(
      (url) => url.pathname.includes('/markets/nearby'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify([
            {
              id: 'm-teste',
              nome: 'Mercado Teste',
              endereco: 'Rua X, 1',
              localizacao: { lat: -23.55, lng: -46.63 },
            },
          ]),
        }),
    );

    // Carrinho COM ESTADO: reflete add/riscar/mercado (o mock base é estático).
    interface Item {
      lineId: string;
      produtoId: string;
      nome: string;
      emoji?: string;
      unitPrice: { cents: number } | null;
      quantity: number;
      comprado: boolean;
    }
    const items: Item[] = [];
    let mercado: unknown = null;
    const sub = (i: Item) => (i.comprado && i.unitPrice ? i.unitPrice.cents * i.quantity : 0);
    const toDTO = () => ({
      id: 'cart-e2e',
      items: items.map((i) => ({ ...i, subtotal: { cents: sub(i) } })),
      total: { cents: items.reduce((s, i) => s + sub(i), 0) },
      limite: null,
      remaining: null,
      progressPercent: 0,
      status: 'sem-limite',
      mercado,
    });

    await page.route(
      (url) => url.pathname.includes('/carts'),
      (route) => {
        const req = route.request();
        const method = req.method();
        const path = new URL(req.url()).pathname;
        const done = (body: unknown) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: {
              'access-control-allow-origin': req.headers()['origin'] ?? '*',
              'access-control-allow-credentials': 'true',
            },
            body: JSON.stringify(body),
          });

        if (path.endsWith('/mercado')) {
          mercado = method === 'DELETE' ? null : JSON.parse(req.postData() ?? '{}');
          return done(toDTO());
        }
        const risca = path.match(/\/items\/([^/]+)\/comprado$/);
        if (risca) {
          const it = items.find((i) => i.lineId === risca[1]);
          if (it && method === 'POST') {
            const b = JSON.parse(req.postData() ?? '{}');
            it.comprado = true;
            it.unitPrice = { cents: b.precoCents };
            it.quantity = b.quantity ?? it.quantity;
          } else if (it && method === 'DELETE') {
            it.comprado = false;
          }
          return done(toDTO());
        }
        if (method === 'POST' && path.endsWith('/items')) {
          const b = JSON.parse(req.postData() ?? '{}');
          items.push({
            lineId: `line-${items.length + 1}`,
            produtoId: b.produtoId,
            nome: b.nome,
            emoji: b.emoji,
            unitPrice: b.unitPriceCents ? { cents: b.unitPriceCents } : null,
            quantity: b.quantity ?? 1,
            comprado: Boolean(b.unitPriceCents),
          });
          return done(toDTO());
        }
        return done(toDTO()); // criar/obter
      },
    );

    await page.goto('/');

    // 1) Monta a lista: adiciona ARROZ SEM preço (item planejado).
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.getByPlaceholder('Buscar produto…').fill('ARROZ');
    await page.getByRole('button', { name: /ARROZ TIO JOAO 5KG/ }).click();
    await page.getByRole('button', { name: /Adicionar à lista/ }).click();

    await expect(page.getByText('ARROZ TIO JOAO 5KG')).toBeVisible();
    await expect(page.getByText(/Toque para riscar quando pegar/)).toBeVisible();
    // Prévia da lista pela base aparece enquanto há item a comprar.
    await expect(page.getByText(/Prévia da lista/)).toBeVisible();

    // 2) Tenta riscar SEM mercado → é OBRIGATÓRIO confirmar o mercado antes.
    await page.getByRole('button', { name: 'Marcar como comprado' }).click();
    await expect(page.getByText('Confirme o mercado primeiro')).toBeVisible();
    await page.getByRole('button', { name: /Confirmar mercado/ }).click();

    // 3) Check-in por GPS → escolhe o mercado mais próximo.
    await expect(page.getByText('Mercado Teste')).toBeVisible();
    await page.getByRole('button', { name: /Sim, é aqui/ }).click();

    // 4) Com o mercado confirmado, o modal de riscar abre SOZINHO. Informa o preço.
    await expect(page.getByText('Peguei este item 🛒')).toBeVisible();
    await page.getByPlaceholder('Preço R$').fill('599');
    await page.getByRole('button', { name: /Riscar/ }).click();

    // Item riscado com preço + botão de finalizar aparece (algo comprado).
    await expect(page.getByText(/R\$\s?5,99 × 1/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Finalizar compra/ })).toBeVisible();

    // Com item riscado, o mercado TRAVA (não dá pra remover/trocar).
    await expect(page.getByText(/🔒 travado/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'remover', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'trocar', exact: true })).toHaveCount(0);
  });

  test('Lista: "repetir última compra" traz os itens da compra anterior', async ({ page }) => {
    await installApiMocks(page, { pro: true });

    // Tem uma compra anterior → habilita o botão na lista vazia.
    await page.route(
      (url) => url.pathname.endsWith('/compras'),
      (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            compras: [
              {
                id: 'c1',
                mercadoId: null,
                mercadoNome: 'Atacadão',
                mercadoEndereco: null,
                totalCents: 1000,
                economiaCents: 0,
                criadaEm: '2026-07-10T12:00:00.000Z',
                itens: [
                  { produtoId: 'p-arroz', nome: 'Arroz Camil', unitPriceCents: 500, quantity: 2 },
                ],
              },
            ],
          }),
        });
      },
    );

    // Carrinho com estado: "repetir-ultima" semeia o item (planejado).
    const items: Array<Record<string, unknown>> = [];
    const toDTO = () => ({
      id: 'cart-e2e',
      items: items.map((i) => ({ ...i, subtotal: { cents: 0 } })),
      total: { cents: 0 },
      limite: null,
      remaining: null,
      progressPercent: 0,
      status: 'sem-limite',
      mercado: null,
    });
    await page.route(
      (url) => url.pathname.includes('/carts'),
      (route) => {
        const path = new URL(route.request().url()).pathname;
        const done = (b: unknown) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify(b),
          });
        if (path.endsWith('/repetir-ultima')) {
          items.push({
            lineId: 'l1',
            produtoId: 'p-arroz',
            nome: 'Arroz Camil',
            emoji: '🍚',
            unitPrice: null,
            quantity: 2,
            comprado: false,
          });
        }
        return done(toDTO());
      },
    );

    await page.goto('/');

    // Lista vazia mostra o atalho → traz os itens da última compra.
    await page.getByRole('button', { name: /Repetir última compra/ }).click();
    await expect(page.getByText('Arroz Camil')).toBeVisible();
    await expect(page.getByText(/Toque para riscar quando pegar/)).toBeVisible();
  });

  test('Minhas listas: usar uma lista salva semeia o carrinho', async ({ page }) => {
    await installApiMocks(page, { pro: true });

    // Uma lista salva → habilita "Minhas listas" na lista vazia.
    await page.route(
      (url) => url.pathname.endsWith('/listas'),
      (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            listas: [
              {
                id: 'L1',
                nome: 'Compra do mês',
                criadaEm: '2026-07-10T12:00:00.000Z',
                itens: [
                  { produtoId: 'p-arroz', nome: 'Arroz Camil', emoji: '🍚', quantity: 2 },
                  { produtoId: 'p-cafe', nome: 'Café Pilão', emoji: '☕', quantity: 1 },
                ],
              },
            ],
          }),
        });
      },
    );

    // Carrinho com estado: "usar-lista" semeia os itens.
    const items: Array<Record<string, unknown>> = [];
    const toDTO = () => ({
      id: 'cart-e2e',
      items: items.map((i) => ({ ...i, subtotal: { cents: 0 } })),
      total: { cents: 0 },
      limite: null,
      remaining: null,
      progressPercent: 0,
      status: 'sem-limite',
      mercado: null,
    });
    await page.route(
      (url) => url.pathname.includes('/carts'),
      (route) => {
        const path = new URL(route.request().url()).pathname;
        const done = (b: unknown) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify(b),
          });
        if (path.includes('/usar-lista/')) {
          items.push(
            {
              lineId: 'l1',
              produtoId: 'p-arroz',
              nome: 'Arroz Camil',
              emoji: '🍚',
              unitPrice: null,
              quantity: 2,
              comprado: false,
            },
            {
              lineId: 'l2',
              produtoId: 'p-cafe',
              nome: 'Café Pilão',
              emoji: '☕',
              unitPrice: null,
              quantity: 1,
              comprado: false,
            },
          );
        }
        return done(toDTO());
      },
    );

    await page.goto('/');

    // Abre "Minhas listas" → usa a lista → os itens entram no carrinho.
    await page.getByRole('button', { name: /Minhas listas/ }).click();
    await expect(page.getByText('Compra do mês')).toBeVisible();
    await page.getByRole('button', { name: 'usar', exact: true }).click();

    await expect(page.getByText('Arroz Camil')).toBeVisible();
    await expect(page.getByText('Café Pilão')).toBeVisible();
  });

  test('Minhas listas: salvar a lista atual como modelo', async ({ page }) => {
    await installApiMocks(page, { pro: true });

    let salvou: { nome?: string } = {};
    await page.route(
      (url) => url.pathname.endsWith('/listas'),
      (route) => {
        const req = route.request();
        if (req.method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify({ listas: [] }),
          });
        }
        // POST /listas → captura e devolve o DTO salvo.
        salvou = JSON.parse(req.postData() ?? '{}');
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            id: 'L1',
            nome: salvou.nome,
            itens: [],
            criadaEm: '2026-07-20T12:00:00.000Z',
          }),
        });
      },
    );

    // Carrinho com estado (pra ter item pra salvar).
    const items: Array<Record<string, unknown>> = [];
    const toDTO = () => ({
      id: 'cart-e2e',
      items: items.map((i) => ({ ...i, subtotal: { cents: 0 } })),
      total: { cents: 0 },
      limite: null,
      remaining: null,
      progressPercent: 0,
      status: 'sem-limite',
      mercado: null,
    });
    await page.route(
      (url) => url.pathname.includes('/carts'),
      (route) => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        const done = (b: unknown) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify(b),
          });
        if (req.method() === 'POST' && path.endsWith('/items')) {
          const b = JSON.parse(req.postData() ?? '{}');
          items.push({
            lineId: 'l1',
            produtoId: b.produtoId,
            nome: b.nome,
            emoji: b.emoji,
            unitPrice: null,
            quantity: b.quantity ?? 1,
            comprado: false,
          });
        }
        return done(toDTO());
      },
    );

    await page.goto('/');

    // Monta a lista com 1 item…
    await page.getByRole('button', { name: '+', exact: true }).click();
    await page.getByPlaceholder('Buscar produto…').fill('ARROZ');
    await page.getByRole('button', { name: /ARROZ TIO JOAO 5KG/ }).click();
    await page.getByRole('button', { name: /Adicionar à lista/ }).click();
    await expect(page.getByText('ARROZ TIO JOAO 5KG')).toBeVisible();

    // …salva como modelo.
    await page.getByRole('button', { name: /Salvar/ }).click();
    await page.getByPlaceholder('Nome da lista').fill('Compra do mês');
    await page.getByRole('button', { name: 'Salvar lista' }).click();

    await expect(page.getByText(/Lista salva/)).toBeVisible();
    expect(salvou.nome).toBe('Compra do mês');
  });

  test('Perfil: "Minhas compras (histórico)" abre o histórico (movido da Compra)', async ({
    page,
  }) => {
    await installApiMocks(page, { pro: true });
    await page.goto('/');

    await page.getByRole('button', { name: /Perfil/ }).click();
    await page.getByRole('button', { name: /Minhas compras \(histórico\)/ }).click();

    // O histórico agora vive no Perfil; sem compras, abre no estado vazio.
    await expect(page.getByText('Nenhuma compra ainda')).toBeVisible();
  });
});
