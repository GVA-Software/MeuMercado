# Pré-mortem — Meu Mercado

> **AÇÃO PENDENTE:** cole aqui o conteúdo do seu pré-mortem (o do artifact que não
> consegui abrir — páginas do claude.ai são renderizadas por JS e o meu leitor só
> enxerga a "casca"). Assim que colar, cada risco vira um ADR e/ou item de backlog
> e os controles entram em `security.md` / `scaling.md` / `testing.md`.

Um pré-mortem imagina o app **fracassado no futuro** e pergunta "o que deu errado?".
Estrutura sugerida para colar:

| Risco / falha imaginada | Causa raiz provável | Impacto | Mitigação | Onde tratamos |
| ----------------------- | ------------------- | ------- | --------- | ------------- |

---

## Riscos que já ANTECIPEI para este produto (rascunho — confirme/edite)

Enquanto seu pré-mortem não chega, estes são os riscos que o desenho já mitiga:

1. **Preços falsos/poluídos (o dado é o coração).** Usuário mal-intencionado injeta
   preços absurdos e destrói a confiança. → Limites de valor no contrato, reputação
   por usuário, mediana/percentis em vez de média simples, moderação, rate-limit.
   _(ver [security.md](security.md) → Anti-fraude de preços)_
2. **Erro de centavos em dinheiro.** Somar `float` acumula erro num app de economia.
   → **Já resolvido**: value object `Money` em centavos inteiros, com testes.
3. **Nina "alucinar" / custo de IA.** → Motor **estatístico** explicável, sem API paga.
4. **Cair sob carga / DDoS.** → Cloudflare na borda, API stateless, tiles na CDN.
5. **Vazamento de dados / LGPD.** App coleta localização + hábitos de compra (dado
   sensível no Brasil). → Minimização, consentimento, criptografia, ver [security.md].
6. **Custo de mapa explodir.** → Nada de Google Maps pago: OSM + MapLibre + PMTiles.
7. **Dependência de um QR de nota fiscal que muda (SEFAZ).** → Parser isolado e
   versionado, com fallback manual sempre disponível.
8. **App quebrar a cada release.** → Pirâmide de testes + CI travando merge.

## Como este documento é usado

- Cada risco confirmado → um item em `docs/adr/` (decisão) ou no backlog.
- Riscos de segurança → controles em [security.md](security.md).
- Riscos de carga → metas e testes em [scaling.md](scaling.md) e [testing.md](testing.md).
