import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA instalável (iOS/Android). Depois, Capacitor empacota este mesmo build.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Meu Mercado',
        short_name: 'MeuMercado',
        description: 'Economize nas compras de supermercado',
        lang: 'pt-BR',
        theme_color: '#FF6B2B',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-512x512.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,woff2}'],
        // O painel de ADM (/admin.html) é uma página separada, fora do SPA:
        // impede o service worker de reescrever a navegação para o index do app.
        navigateFallbackDenylist: [/^\/admin/],
        // Handlers de Web Push (push + notificationclick) importados no SW gerado.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  server: { port: 5173 },
});
