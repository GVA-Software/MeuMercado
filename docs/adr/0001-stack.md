# ADR 0001 — Stack base (PWA, NestJS, mapa OSS)

- **Status:** aceito
- **Contexto:** PWA para iOS/Android (lojas depois), tudo em POO, sem API paga, seguro,
  escalável e testável.

## Decisão

- **Front:** React + Vite + TypeScript + Workbox (PWA); **Capacitor** para empacotar nas
  lojas (dá GPS em background para a aba Mapa).
- **Back:** **NestJS** (POO: módulos, DI, guards) + **TypeORM** (entidades = classes) +
  **PostgreSQL/PostGIS** + **Redis**.
- **Mapa sem API paga:** **OpenStreetMap** + **MapLibre GL** + tiles **Protomaps/PMTiles**
  (na CDN) + **Valhalla** (rotas) + **Photon/Nominatim** (busca).
- **Borda:** **Cloudflare** (CDN/WAF/anti-DDoS) + **Turnstile** (CAPTCHA grátis).

## Consequências

- Uma linguagem (TypeScript) do banco ao app → menos atrito, contratos compartilhados.
- Motores geo são binários pesados → rodam em **Docker** (VPS), não "serverless".
- Escala de leitura do mapa sai barata (tiles estáticos na CDN).
