# Meu Mercado

App de **economia em compras de supermercado** (PWA): carrinho com limite de orçamento,
tabela de preços colaborativa, comparação entre mercados, assinatura **Pro** e a
assistente **Nina IA** (insights por estatística, sem API paga). A aba **Mapa** — "nosso
Waze/Maps" — mostra mercados por perto e onde cada produto está mais barato, sobre
**OpenStreetMap** (sem Google Maps pago).

> Codinome do pacote: `@meumercado/*` (o nome do produto pode mudar sem impacto estrutural).

## Princípios

- **POO em todo lugar** — domínio modelado com classes; NestJS (módulos + DI) no back.
- **Sem API paga** — Nina estatística; mapa com MapLibre + OpenStreetMap + Valhalla + Photon.
- **Seguro por padrão** — validação estrita (zod), Argon2id, JWT, gating no servidor, helmet, rate-limit; Cloudflare/Turnstile na borda.
- **Escalável** — serviços stateless, repositórios trocáveis, tiles estáticos na CDN.
- **Qualidade** — pirâmide de testes (unit → integração → e2e → carga) com CI travando merge.

## Estrutura do monorepo

```
apps/mobile        PWA (React + Vite)            apps/api        Backend NestJS
packages/domain    domínio POO puro (+ testes)   packages/contracts   DTOs/zod compartilhados
docs/  arquitetura, segurança, escala, testes, ADRs, pré-mortem      .github/  CI (Actions/CodeQL)
infra/, services/  (a fazer) Docker + motores de mapa
```

## Rodando o app (sem pnpm, sem Docker)

Pré-requisito: **Node ≥ 20**. O repositório usa **npm workspaces** (também funciona com pnpm).
A API sobe com repositórios **em memória** — não precisa de banco para ver o app.

```bash
npm install                 # instala tudo (workspaces) e linka os pacotes
```

### DEV (hot-reload)

API em `:3000` + PWA (Vite/HMR) em `:5173`. **Abra http://localhost:5173**.

```bash
npm run dev
```

### PROD (build otimizado, um único endereço)

Faz o build de tudo e a **própria API serve a PWA** em `:3000` (single-origin, como num
deploy real atrás da Cloudflare). **Abra http://localhost:3000**.

```bash
npm run start:prod          # = npm run build && npm run start
```

> **Só um ambiente por vez** — DEV e PROD usam a porta `:3000`. Se sobrar um processo
> ocupando a porta, no Windows: > `Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

### Ver funcionando por linha de comando

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/insights      # Nina (ex.: "Café subiu 17%")
curl http://localhost:3000/api/prices/cafe/summary
```

## Scripts úteis

```bash
npm run build       # build de todos os workspaces
npm run typecheck   # TypeScript em todos os pacotes
npm test            # testes (49 unit até agora)
npm run lint        # ESLint
npm run format      # Prettier
```

## Segredos

- `apps/api/.env` (gitignored) já foi gerado com segredos JWT locais para o modo PROD.
- Front (Vite): `apps/mobile/.env.development` aponta para a API em `:3000`;
  `apps/mobile/.env.production` usa caminho relativo (single-origin).

## Documentação

- [Arquitetura](docs/architecture.md) · [Segurança + LGPD](docs/security.md) ·
  [Escalabilidade](docs/scaling.md) · [Testes](docs/testing.md) ·
  [Pré-mortem](docs/pre-mortem.md) · [Decisões (ADRs)](docs/adr/)

## Licença

Dados do OpenStreetMap sob [ODbL](https://www.openstreetmap.org/copyright) — a atribuição
"© OpenStreetMap contributors" deve aparecer no mapa.
