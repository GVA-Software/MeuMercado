import { defineConfig, devices } from '@playwright/test';

/**
 * E2E da PWA — camada de topo da pirâmide de testes.
 *
 * Estratégia: dirigimos o app REAL (build de dev do Vite) num viewport mobile e
 * interceptamos a fronteira de rede (`**\/api/**`) com respostas canônicas
 * (ver `e2e/fixtures.ts`). Assim o teste é hermético — não precisa de API nem
 * banco — e valida exatamente a fiação do front: portão de login, troca de abas,
 * render da tabela de preços (tendência) e liberação/paywall da Nina.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Local capado em 2: o WebKit sobe páginas devagar e, com muitos workers em
  // paralelo (padrão = nº de núcleos), dá timeout na criação da página (flaky).
  // No CI é 1 (serial) — determinístico.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // Sem service worker no teste: o SW da PWA (só existe no build de produção)
    // não deve interceptar as rotas que estamos mockando.
    serviceWorkers: 'block',
  },
  // Rodamos a jornada em DOIS motores. `mobile-safari` usa o WebKit — o MESMO
  // engine do Safari/iOS. Isso pega bugs que só aparecem no iPhone (ex.: telas
  // empilhando por key React duplicada) e que o Chromium tolera silenciosamente.
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Base relativa → chamadas same-origin (sem CORS/preflight); o mock as pega.
    env: { VITE_API_BASE_URL: '/' },
  },
});
