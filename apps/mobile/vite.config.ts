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
        background_color: '#FAFAF7',
        display: 'standalone',
        start_url: '/',
        // TODO(assets): adicionar icons 192x192 e 512x512 em public/ e referenciar aqui.
        icons: [],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
  server: { port: 5173 },
});
