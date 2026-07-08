# Estratégia de testes — Meu Mercado

Meta do usuário: **nunca quebrar**. Fazemos isso com uma pirâmide de testes e um CI que
**trava o merge** quando algo fica vermelho.

## Pirâmide

1. **Unitário** (rápido, muitos) — regras de domínio puras: `Money`, `Cart`,
   `PriceStatistics`, `StatisticalInsightEngine`. Ferramenta: **Vitest** (packages) /
   **Jest** (NestJS). ✅ já rodando: 32 (domain) + 5 (contracts).
2. **Integração** — módulos da API contra **Postgres/Redis reais** via **Testcontainers**
   (sobem em Docker no CI). Ex.: enviar preço → recomputar estatística.
3. **Contrato** — os schemas **zod** garantem que back e front falam o mesmo formato;
   testes verificam parsing/rejeição (já iniciado em `contracts.spec.ts`).
4. **E2E** — **Playwright** dirige a PWA: abrir, adicionar item ao carrinho, ver limite,
   abrir o Mapa, gerar insight da Nina.
5. **Carga** — **k6** valida p95/erros sob carga (ver [scaling.md](scaling.md)).
6. **Segurança** — **CodeQL** + `npm audit` no CI; revisão das regras anti-fraude.

## Regras

- **Cobertura mínima** nos pacotes de domínio (a lógica de dinheiro/preço é crítica).
- **Pre-commit** (husky + lint-staged): lint + typecheck + testes afetados.
- **CI** (GitHub Actions): lint → typecheck → unit → integração → build → e2e. Merge só com
  tudo verde.
- **Determinismo:** domínio não usa relógio interno — datas entram por parâmetro (ver
  `PriceStatistics`), então os testes não "piscam".

## Como rodar (hoje)

```bash
# núcleo já verificável sem Docker:
cd packages/domain   && npx vitest run   # 32 testes
cd packages/contracts && npm test        # 5 testes
```
