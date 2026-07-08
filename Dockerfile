# Imagem única que builda tudo e serve a API + PWA (single-origin).
# Funciona em Render, Railway, Fly.io, Cloud Run, etc.

# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

# ---------- runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Copia dependências já instaladas + artefatos de build.
COPY --from=build /app ./
# A plataforma injeta PORT; o app usa PORT ?? 3000.
EXPOSE 3000
# Segredos JWT devem vir por variável de ambiente em runtime:
#   docker run -e JWT_ACCESS_SECRET=... -e JWT_REFRESH_SECRET=... -e COOKIE_SECURE=true -p 3000:3000 <img>
CMD ["node", "apps/api/dist/main.js"]
