# Arquitetura — Meu Mercado

App de **economia em compras de supermercado** (carrinho com limite, tabela de preços
colaborativa, comparação entre mercados, Nina IA e a aba Mapa) entregue como **PWA** e
preparado para as lojas. **POO em todo lugar**, **sem API paga**, seguro e escalável.

## Visão em camadas

```
┌──────────────────────────────────────────────────────────────┐
│  PWA (apps/mobile)  React + Vite + MapLibre  →  Capacitor      │
│  Telas: Compra · Mapa · Nina · Histórico · Perfil             │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS (contratos zod compartilhados)
        ┌───────▼────────┐   Cloudflare (CDN · WAF · anti-DDoS · Turnstile)
        │  API (NestJS)  │  módulos POO: catálogo, preços, carrinho,
        │  apps/api      │  mercados+mapa, insights(Nina), auth, assinatura
        └───┬───────┬────┘
            │       │
    ┌───────▼──┐  ┌─▼─────────┐   ┌─────────────── services/ (OSS, Docker) ───────────────┐
    │ Postgres │  │  Redis    │   │ Valhalla (rotas) · Photon/Nominatim (busca) · PMTiles │
    │ +PostGIS │  │ cache/rt  │   │ (tiles OSM na CDN)                                     │
    └──────────┘  └───────────┘   └────────────────────────────────────────────────────────┘
```

## Pacotes compartilhados (o núcleo, já implementado e testado)

- **`packages/domain`** — modelo de domínio POO **puro** (sem framework), 100% testável:
  - `Money` (centavos inteiros — nunca float) · `Produto`/`Categoria` · `Mercado` (com geo)
  - `PriceObservation` + `PriceStatistics` (média, mín/máx, tendência) — base da tabela e da Nina
  - `Cart`/`CartItem` (aggregate root do orçamento/limite)
  - `Insight` + `StatisticalInsightEngine` (**Nina** — interface `InsightEngine` plugável)
  - `GeoPoint`/`Bounds`/`Route` (apoio à aba Mapa)
  - ✅ **32 testes** + `tsc` estrito verdes.
- **`packages/contracts`** — schemas **zod** (produtos, preços, carrinho, mercados,
  geocode, rotas, insights). Fonte única de verdade valida requisições no back e respostas
  no front. ✅ **5 testes** + typecheck verdes.

Por que separar `domain` de `contracts`: o domínio guarda **regras e comportamento**
(POO); os contratos guardam o **formato do dado na rede** (wire). O front reusa `Money`/
`Cart` do `domain` para calcular igual ao servidor; a API mapeia domínio ↔ DTO na borda.

## Fluxo de dados: preço colaborativo → insight

1. Usuário envia preço (manual / QR da nota / foto) → `ReportPriceSchema` valida.
2. API grava `PriceObservation` (Postgres) com `reporterId` (para reputação/anti-fraude).
3. `PriceStatistics` recomputa média/tendência (cacheado no Redis).
4. `StatisticalInsightEngine` gera insights da Nina sob demanda.
5. Aba Mapa usa `Mercado.localizacao` (PostGIS) + Valhalla para "mercado mais barato perto + como chegar".

## Decisões confirmadas

| Tema             | Decisão                                                     | ADR                                  |
| ---------------- | ----------------------------------------------------------- | ------------------------------------ |
| Backend          | NestJS (TypeScript, POO)                                    | [0001](adr/0001-stack.md)            |
| Mapa/rotas/busca | OSM + MapLibre + PMTiles + Valhalla + Photon (sem API paga) | [0001](adr/0001-stack.md)            |
| Nina IA          | Motor estatístico (sem LLM pago), interface plugável        | [0002](adr/0002-nina-estatistica.md) |
| Dinheiro         | `Money` em centavos inteiros                                | [0003](adr/0003-money-centavos.md)   |
| Preços           | Colaborativos (usuários) + anti-fraude                      | [security.md](security.md)           |
| Infra            | VPS + Docker + Cloudflare                                   | [scaling.md](scaling.md)             |

## Status de implementação

- ✅ Monorepo + tooling · ✅ `domain` · ✅ `contracts`
- ⏳ `apps/api` (NestJS) · ⏳ `apps/mobile` (PWA) · ⏳ `infra/docker` + services · ⏳ CI
