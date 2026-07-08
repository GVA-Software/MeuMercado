import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module, type DynamicModule, type ForwardReference, type Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv, type Env } from './config/env.schema.js';
import { DataModule } from './data/data.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { InsightsModule } from './modules/insights/insights.module.js';

type ModuleImport = Type | DynamicModule | Promise<DynamicModule> | ForwardReference;

const imports: ModuleImport[] = [
  ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
  // Rate limiting distribuível (troca o storage por Redis em produção).
  ThrottlerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>) => ({
      throttlers: [
        {
          ttl: config.get('RATE_LIMIT_TTL', { infer: true }) * 1000,
          limit: config.get('RATE_LIMIT_MAX', { infer: true }),
        },
      ],
    }),
  }),
  DataModule,
  HealthModule,
  AuthModule,
  BillingModule,
  CatalogModule,
  PricingModule,
  CartModule,
  InsightsModule,
];

// Em PRODUÇÃO, a API serve o build estático da PWA (single-origin, como num
// deploy real atrás da Cloudflare). As rotas /api/* seguem para os controllers.
if (process.env.NODE_ENV === 'production') {
  const mobileDist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'mobile', 'dist');
  imports.push(
    ServeStaticModule.forRoot({
      rootPath: mobileDist,
      exclude: ['/api/(.*)'],
    }),
  );
}

@Module({
  imports,
  // Rate limit aplicado globalmente a todas as rotas.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
