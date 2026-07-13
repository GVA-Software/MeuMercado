import { test, expect } from '@playwright/test';
import { installApiMocks } from './fixtures';

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
    await page.getByRole('button', { name: /CAFE PILAO 500G/ }).click();
    await expect(page.getByText('Atacadao', { exact: true })).toBeVisible();
    await expect(page.getByText(/12,90/).first()).toBeVisible(); // resumo + cartão
    await expect(page.getByText('Rossi', { exact: true })).toBeVisible();
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

  test('cobertura: "Complete a comparação" leva ao registro do produto', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    // Sobrescreve a rota do mutirão com 1 produto (só tem 1 mercado).
    await page.route(
      (url) => url.pathname.endsWith('/prices/para-completar'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify([
            {
              produto: {
                id: 'p-sabao',
                nome: 'SAB. EM PO OMO 1KG',
                categoria: 'Outros',
                unidade: 'un',
                emoji: '🧼',
              },
              precoCents: 1890,
              mercadoNome: 'Atacadao',
              atualizadoEm: '2026-07-10T12:00:00.000Z',
            },
          ]),
        }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: /Preços/ }).click();

    // A seção aparece com o produto que só tem 1 preço.
    await expect(page.getByText('Complete a comparação')).toBeVisible();
    await page.getByText('SAB. EM PO OMO 1KG').click();

    // Abre o registro JÁ com o produto escolhido (só falta preço + mercado).
    // Subtítulo é exclusivo do sheet de registro (evita casar com o botão da tela).
    await expect(page.getByText(/Ajude a comunidade: quanto custou e onde/)).toBeVisible();
    await expect(page.getByText('trocar')).toBeVisible(); // produto pré-selecionado
  });

  test('Nina (Free): mostra o paywall em vez dos insights', async ({ page }) => {
    await installApiMocks(page, { pro: false });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();

    await expect(page.getByText('A Nina IA é um recurso Pro')).toBeVisible();
  });
});
