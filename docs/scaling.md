# Escalabilidade e resiliência — Meu Mercado

Meta do usuário: **milhares de usuários simultâneos** e **nunca cair**.

## Princípios

- **API stateless** → escala horizontal (N réplicas atrás de load balancer). Nenhum estado
  em memória do processo; sessão/cache/rate-limit ficam no **Redis** compartilhado.
- **Tiles do mapa como estáticos (PMTiles) na CDN** → o tráfego mais pesado (o mapa) nem
  toca a origem. Escala de leitura praticamente infinita e barata.
- **Cache agressivo** (Redis + CDN) para dados quentes: médias de preço, resultados de
  geocoding e rotas (que mudam pouco).
- **Postgres**: começa único; cresce com **réplicas de leitura** + **PgBouncer** (pool).
  Estatística de preço é read-heavy → cacheável.
- **Motores geo** (Valhalla/Photon) são read-only e replicáveis; ficam atrás de cache.

## Resiliência ("nunca derrubar")

- **Cloudflare** absorve DDoS e faz rate-limit antes de chegar na origem.
- **Degradação graciosa:** se um motor geo cair, o resto do app (carrinho, preços, Nina)
  continua; a aba Mapa mostra aviso, não derruba tudo.
- **Health checks** (`/health` liveness/readiness) + reinício automático (Docker/orquestrador).
- **Timeouts e circuit breakers** nas chamadas aos motores externos.
- **Backups** do Postgres + testes de restauração.

## Como validamos os números (não prometer sem medir)

- **k6** roda cenários de carga (envio de preço, listar tabela, gerar insight, buscar
  mercados) no CI/staging e reporta p95/erros antes de anunciarmos capacidade.

## Dados OSM (dev x prod)

- **Dev:** extrato regional do Geofabrik (um estado) — leve, cabe na máquina.
- **Prod:** país inteiro, processado uma vez e servido como PMTiles pela CDN.
