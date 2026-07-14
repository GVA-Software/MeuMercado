import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { helmetOptions } from './common/security/helmet.config.js';
import type { Env } from './config/env.schema.js';

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

// Cacheado entre invocações "quentes" da função serverless (evita re-bootstrap).
let cached: NodeHandler | null = null;

/**
 * Cria (uma vez) a app Nest para rodar como **função serverless** (Vercel):
 * inicializa sem `listen()` e devolve o handler Express. A mesma segurança do
 * `main.ts` é aplicada. Estado persiste no Postgres (via DATABASE_URL).
 */
export async function getServerlessHandler(): Promise<NodeHandler> {
  if (cached) return cached;
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });
  app.set('trust proxy', 1);
  app.use(helmet(helmetOptions));
  app.use(cookieParser());
  // CORS restrito à allowlist (mesma política do main.ts) — NUNCA refletir qualquer
  // origem com credentials (permitiria a um site atacante ler tokens da sessão).
  const config = app.get(ConfigService<Env, true>);
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');
  await app.init();
  cached = app.getHttpAdapter().getInstance() as unknown as NodeHandler;
  return cached;
}
