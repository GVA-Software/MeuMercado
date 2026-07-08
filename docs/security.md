# Segurança — Meu Mercado

Metas do usuário: **não sermos hackeados**, **nunca derrubarem** e proteger os dados.
Abaixo, o modelo de ameaças específico deste app e os controles.

## Superfícies e ameaças principais

| Ameaça                    | Vetor                                           | Controle                                                   |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| **Fraude de preços**      | Usuário injeta preços falsos e polui a base     | Ver seção "Anti-fraude"                                    |
| Tomada de conta           | Força bruta, credenciais vazadas                | Argon2id, rate-limit login, Turnstile, 2FA (futuro)        |
| DDoS / derrubar           | Flood L3/L7                                     | Cloudflare (anti-DDoS + WAF), API stateless, tiles na CDN  |
| Injeção                   | SQL/NoSQL/命令                                  | ORM parametrizado (TypeORM), validação zod/class-validator |
| Vazamento de dados / LGPD | Localização + hábitos de compra (dado sensível) | Minimização, criptografia, consentimento (ver LGPD)        |
| Abuso de API              | Scraping, spam                                  | Rate-limit por IP+usuário (Redis), cotas, autenticação     |
| Fraude de assinatura      | Burlar o paywall Pro                            | Validação server-side de entitlements, webhooks do gateway |

## Anti-fraude de preços (o risco nº 1 — o dado é o produto)

- **Validação de plausibilidade** no contrato (`ReportPriceSchema`): valor > 0, teto,
  data não-futura.
- **Reputação por usuário** (`reporterId` em cada `PriceObservation`): novos usuários
  pesam menos; histórico consistente pesa mais.
- **Estatística robusta**: usar **mediana/percentis** e descartar outliers, não só média —
  um preço absurdo isolado não move a "média regional".
- **Rate-limit de envios** por usuário/produto/mercado (Redis).
- **Moderação**: fila de revisão para desvios grandes; possibilidade de "denunciar preço".
- **Corroboração**: preço ganha confiança quando várias fontes independentes concordam;
  QR de nota fiscal (SEFAZ) vale mais que digitação manual.

## Controles transversais (desde o dia 1)

- **Borda (Cloudflare):** WAF, mitigação DDoS, rate-limit, TLS/HSTS. A origem só aceita
  tráfego vindo da Cloudflare.
- **API (NestJS):** `helmet`, CORS allowlist, `ThrottlerGuard` distribuído (Redis), limite
  de tamanho de payload, `ValidationPipe` com whitelist + `forbidNonWhitelisted`, filtros
  de exceção que não vazam stack.
- **Auth:** Argon2id, JWT de acesso curto + refresh rotativo em cookie httpOnly/Secure/
  SameSite, **Turnstile** (grátis) em signup/login.
- **Dados:** usuário de banco com menor privilégio, migrations versionadas, segredos fora
  do git (`.env`), rotação de segredos.
- **Supply chain:** lockfile fixo, `npm audit`/Dependabot, **CodeQL** no CI.
- **Pagamentos:** delegados a um gateway (Mercado Pago/Stripe) — **não** guardamos dados
  de cartão; o app só confia em webhooks assinados para liberar o Pro.

## LGPD (app brasileiro, dado pessoal + localização)

- **Base legal e consentimento** explícito para localização e histórico de compras.
- **Minimização:** só coletar o necessário; localização pode ser aproximada quando exata
  não for preciso.
- **Direitos do titular:** exportar e **apagar** a conta e os dados.
- **Retenção:** política de expurgo; anonimização de observações antigas para estatística.
- **Segurança:** criptografia em trânsito e em repouso; registro de acesso a dado pessoal.

> Detalhes de carga/resiliência em [scaling.md](scaling.md); riscos abertos em
> [pre-mortem.md](pre-mortem.md).
