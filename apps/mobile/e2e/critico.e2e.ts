import { test, expect } from '@playwright/test';
import { installApiMocks } from './fixtures';

/**
 * Jornada crítica do usuário, ponta a ponta:
 *   entrar → ver a tabela de preços (tendência) → Nina (liberada e bloqueada).
 * Fecha a pirâmide de testes na camada de UI, cobrindo os recursos que blindamos.
 */
test.describe('Meu Mercado — jornada crítica', () => {
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

  test('Nina (Pro): mostra insight citando preços reais', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();

    // Empurrãozinho em destaque no topo + alerta citando preços reais na lista.
    await expect(page.getByText(/EMPURRÃOZINHO/)).toBeVisible();
    await expect(page.getByText('Compare o ARROZ TIO JOAO e economize')).toBeVisible();
    await expect(page.getByText('ARROZ TIO JOAO subiu 4%')).toBeVisible();
    await expect(page.getByText(/Passou de R\$ 24,90 para R\$ 31,00/)).toBeVisible();
  });

  test('loop de cobertura: tocar o empurrãozinho abre o registro do produto', async ({ page }) => {
    await installApiMocks(page, { pro: true });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();
    await page.getByText('Compare o ARROZ TIO JOAO e economize').click();

    // Deep-link levou aos Preços com o registro aberto e o produto pré-selecionado.
    await expect(page.getByText(/Ajude a comunidade/)).toBeVisible();
    await expect(page.getByText('trocar')).toBeVisible(); // produto já selecionado
  });

  test('Nina (Free): mostra o paywall em vez dos insights', async ({ page }) => {
    await installApiMocks(page, { pro: false });
    await page.goto('/');

    await page.getByRole('button', { name: /Nina IA/ }).click();

    await expect(page.getByText('A Nina IA é um recurso Pro')).toBeVisible();
  });
});
