import 'reflect-metadata';
import { setDefaultResultOrder } from 'node:dns';
// Render (e muitos hosts) não têm rota IPv6 de SAÍDA. Alguns destinos resolvem IPv6
// primeiro e o connect falha com ENETUNREACH (ex.: smtp.gmail.com → 2607:f8b0:…).
// Preferir IPv4 em TODAS as resoluções DNS evita isso (fetch já cai no IPv4 via
// Happy Eyeballs; o SMTP do nodemailer não caía). Precisa vir antes de qualquer lookup.
setDefaultResultOrder('ipv4first');
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { helmetOptions } from './common/security/helmet.config.js';
import type { Env } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // Atrás de proxy (Cloudflare/Render/etc.): confia no X-Forwarded-* para
  // detectar HTTPS — necessário para cookies Secure funcionarem.
  app.set('trust proxy', 1);

  // Cabeçalhos de segurança (CSP, HSTS, no-sniff, etc.)
  app.use(helmet(helmetOptions));
  // Lê cookies (refresh token httpOnly).
  app.use(cookieParser());

  // CORS restrito à allowlist (sem "*" em produção).
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Tratamento de erro consistente e sem vazar internals.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Todos os endpoints sob /api. (O parser JSON do Express já limita o corpo a
  // ~100kb por padrão — guarda simples contra payloads gigantes.)
  app.setGlobalPrefix('api');

  // A plataforma injeta PORT; localmente cai para API_PORT (3000).
  const port =
    config.get('PORT', { infer: true }) ?? config.get('API_PORT', { infer: true }) ?? 3000;
  // 0.0.0.0 para aceitar conexões externas no container/host de deploy.
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API no ar na porta ${port} (/api)`);
}

void bootstrap();
