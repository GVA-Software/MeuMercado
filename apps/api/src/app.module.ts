import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module, type DynamicModule, type ForwardReference, type Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv, type Env } from './config/env.schema.js';
import { DataModule } from './data/data.module.js';
import { PersistenceModule } from './infrastructure/database/persistence.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { GeocodeModule } from './modules/geocode/geocode.module.js';
import { MarketsModule } from './modules/markets/markets.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { NfceModule } from './modules/nfce/nfce.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { ComprasModule } from './modules/compras/compras.module.js';
import { InsightsModule } from './modules/insights/insights.module.js';
import { PushModule } from './modules/push/push.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { QaModule } from './qa/qa.module.js';

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
  PersistenceModule.forRoot(),
  DataModule,
  HealthModule,
  AuthModule,
  AdminModule,
  BillingModule,
  CatalogModule,
  GeocodeModule,
  MarketsModule,
  PricingModule,
  NfceModule,
  CartModule,
  ComprasModule,
  InsightsModule,
  PushModule,
  AnalyticsModule,
  QaModule,
];

// Em PRODUÇÃO num host de processo (Render/Docker), a API serve o build estático
// da PWA (single-origin). Na Vercel NÃO — lá a própria Vercel serve os estáticos
// e roteia só /api/* para a função serverless.
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
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
