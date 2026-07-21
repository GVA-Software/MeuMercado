# Plano de Resposta a Incidente de Segurança / Dados Pessoais

**Meu Mercado — GVA Software** · Encarregado (DPO): gvasoftware7@gmail.com
Versão 1 · 16/07/2026 · revisar a cada 6 meses.

> Base legal: LGPD art. 48 + **Resolução ANPD nº 15/2024** — comunicar a ANPD e os
> titulares em **até 3 dias úteis** a contar do conhecimento de um incidente que possa
> acarretar risco ou dano relevante. O **descumprimento do dever de notificar é infração
> autônoma** — a demora é o que mais pesa na multa. Na dúvida, **notifique**.

## Papéis

- **Detector**: quem primeiro percebe o incidente (qualquer pessoa da equipe, alerta,
  usuário ou pesquisador de segurança que reportar).
- **Responsável pela decisão (Encarregado)**: gvasoftware7@gmail.com — decide se
  notifica ANPD/titulares, redige as comunicações e mantém o registro.

## O que conta como incidente

Acesso não autorizado, vazamento, perda, alteração ou destruição de dados pessoais.
Exemplos: dump do banco (Neon), credencial/segredo exposto, conta de admin invadida,
bug que expõe dados de um usuário a outro, e-mail em massa com dados indevidos.

## Fluxo (assim que houver suspeita)

1. **Conter** (imediato): revogar a credencial/segredo comprometido, encerrar sessões,
   derrubar o vetor (ex.: desligar rota, girar `JWT_*`/`DATABASE_URL`/chaves na Render e
   no Google/Neon). Preservar evidências (logs de acesso — tabela `access_logs`).
2. **Avaliar** (horas): que dados, de quantos titulares, qual a gravidade e o risco de
   dano. Registrar linha do tempo (quando ocorreu × quando foi detectado).
3. **Decidir a notificação** (dentro dos **3 dias úteis**): se há risco/dano relevante →
   notificar **ANPD** e **titulares afetados**. Se claramente sem risco, registrar a
   justificativa da não-notificação.
4. **Notificar**:
   - **ANPD**: formulário oficial de comunicação de incidente em
     https://www.gov.br/anpd (Comunicação de Incidente de Segurança). Conteúdo mínimo:
     natureza dos dados, titulares envolvidos (nº), medidas técnicas/segurança adotadas,
     riscos, medidas de mitigação e a data de conhecimento.
   - **Titulares**: e-mail claro (modelo abaixo).
5. **Remediar e aprender**: corrigir a causa-raiz, e registrar no
   [registro de incidentes](./registro-de-incidentes.md) (mesmo que a decisão tenha sido
   NÃO notificar).

## Modelo de e-mail ao titular

> **Assunto:** Comunicado de segurança — Meu Mercado
>
> Olá, [nome]. Identificamos em [data] um incidente de segurança que pode ter afetado
> dados da sua conta: [quais dados]. Já [medidas tomadas: ex. giramos as chaves, encerramos
> as sessões]. Recomendamos que você [ação: trocar a senha, etc.]. **Nós nunca pedimos sua
> senha por e-mail.** Dúvidas: gvasoftware7@gmail.com. — Equipe Meu Mercado.

## Checklist de "girar segredos" (na Render → Environment)

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL` (Neon), `CRON_SECRET`,
`GMAIL_*`, `VAPID_*`, `TURNSTILE_*`. Confirmar cláusula de notificação de breach nos
contratos (DPA) de **Render, Neon e Google**.
