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
    await expect(page.getByText(/Achei 2 tipos de "café"/)).toBeVisible();

    // Escolhe um tipo → mercados ranqueados (mais barato primeiro).
    await page.getByRole('button', { name: /CAFE PILAO 500G/ }).click();
    await expect(page.getByText('Atacadao', { exact: true })).toBeVisible();
    await expect(page.getByText(/12,90/).first()).toBeVisible(); // resumo + cartão
    await expect(page.getByText('Rossi', { exact: true })).toBeVisible();
  });

  test('Nina (Free): mostra o paywall em vez dos insights', async ({ page }) => {
    await installApiMocks(page, { pro: false });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();

    await expect(page.getByText('A Nina IA é um recurso Pro')).toBeVisible();
  });
});
