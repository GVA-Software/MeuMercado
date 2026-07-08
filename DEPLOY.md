# Deploy — DEV e PROD com URLs públicas

O app é **single-origin**: a API (NestJS) serve a PWA junto, então **1 serviço = 1 URL**.
Como ainda usamos dados **em memória** (sem Postgres), precisamos de um host de **processo
persistente** — por isso **Render** (grátis) em vez de Vercel (serverless perderia o estado).

> Depois que plugarmos Postgres, dá para ir a qualquer lugar (inclusive Vercel + banco gerenciado).

---

## Passo 1 — Subir o código no GitHub

Já deixei o repositório git iniciado e commitado, com um branch `main` e um `develop`.
Falta apenas criar o repositório **na sua conta** e dar push:

1. Crie um repositório vazio em https://github.com/new (ex.: `meumercado`), **sem** README.
2. No terminal, na pasta do projeto:

```bash
git remote add origin https://github.com/<SEU_USUARIO>/meumercado.git
git push -u origin main
git push -u origin develop
```

(O Git Credential Manager do Windows abre o navegador para você autenticar.)

---

## Passo 2 — Deploy no Render (2 URLs: PROD e DEV)

O arquivo [`render.yaml`](render.yaml) já define os dois serviços.

1. Acesse https://dashboard.render.com → **New** → **Blueprint**.
2. Conecte sua conta GitHub e selecione o repositório `meumercado`.
3. O Render lê o `render.yaml` e cria **dois serviços**:
   - **meumercado-prod** → segue o branch `main`
   - **meumercado-dev** → segue o branch `develop`
4. Clique em **Apply**. Em alguns minutos você recebe as URLs:
   - PROD: `https://meumercado-prod.onrender.com`
   - DEV: `https://meumercado-dev.onrender.com`

Os segredos JWT são **gerados pelo Render** (não ficam no repo). Auto-deploy: cada `git push`
no branch correspondente redeploya sozinho.

> Plano free: o serviço "dorme" após ~15 min sem acesso e acorda em ~30s no primeiro request.
> Como não há banco ainda, os dados (carrinho/contas) reiniciam quando o serviço reinicia — ok para demonstração.

---

## Alternativa — Docker (Railway, Fly.io, Cloud Run, VPS…)

Há um [`Dockerfile`](Dockerfile) pronto (buila e serve tudo):

```bash
docker build -t meumercado .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e COOKIE_SECURE=true \
  -e JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  -e JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
  meumercado
# abra http://localhost:3000
```

Em Railway/Fly/Cloud Run: aponte para o `Dockerfile` e configure as mesmas variáveis
(`NODE_ENV=production`, `COOKIE_SECURE=true`, e os dois segredos JWT).

---

## Variáveis de ambiente (produção)

| Variável | Valor | Para quê |
|---|---|---|
| `NODE_ENV` | `production` | Ativa o modo prod (API serve a PWA) |
| `PORT` | (injetado pela plataforma) | Porta de escuta |
| `COOKIE_SECURE` | `true` | Cookie de refresh só via HTTPS |
| `JWT_ACCESS_SECRET` | segredo forte (≥32 chars) | Assinar access token |
| `JWT_REFRESH_SECRET` | segredo forte (≥32 chars) | Assinar refresh token |
| `TURNSTILE_SECRET_KEY` | (opcional) | Ativa verificação anti-bot no cadastro/login |

> A app **recusa subir** em produção com segredos fracos/padrão — proposital (segurança).
