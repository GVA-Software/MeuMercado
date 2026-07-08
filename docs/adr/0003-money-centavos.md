# ADR 0003 — Dinheiro em centavos inteiros

- **Status:** aceito
- **Contexto:** o protótipo somava preços em `float` (`preco*qty`). Num app cujo
  propósito é **economizar dinheiro**, erro de ponto flutuante (`0.1 + 0.2 !== 0.3`)
  acumula centavos e quebra a confiança.

## Decisão

Value object **`Money`** (`packages/domain/money`) armazena **centavos inteiros** e faz
toda a aritmética em inteiros; conversão para reais só na borda (UI). Trafega na rede como
`{ cents, currency }` (`MoneySchema`).

## Consequências

- Precisão exata em somas/multiplicações; imutável e testado.
- Comparações de moeda diferentes são bloqueadas (`CurrencyMismatchError`).
- Todo preço/subtotal/limite no app passa por `Money` — sem `number` solto para dinheiro.
