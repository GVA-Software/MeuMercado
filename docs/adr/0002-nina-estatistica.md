# ADR 0002 — Nina IA por estatística (sem LLM pago)

- **Status:** aceito
- **Contexto:** a Nina precisa gerar insights ("seu café subiu 17%", "mais barato no
  Atacadão", "cesta ótima economiza R$ 21") **sem API paga** e sem cair/alucinar.

## Decisão

Implementar a Nina como um **motor estatístico/algorítmico** sobre o histórico de preços:
tendência por janelas de tempo, comparação de médias por mercado, otimização de cesta.
Encapsulado atrás da interface **`InsightEngine`** (`packages/domain/insights`), com a
implementação `StatisticalInsightEngine`.

## Consequências

- **Grátis, determinístico e explicável** — cada insight tem uma regra auditável.
- **Zero risco de alucinação** e nenhum ponto de falha externo.
- Interface plugável: no futuro dá para adicionar um `LlmInsightEngine` (modelo
  auto-hospedado) só para "escrever o texto", sem reescrever o app.
- ✅ Coberto por testes unitários (`InsightEngine.spec.ts`).
