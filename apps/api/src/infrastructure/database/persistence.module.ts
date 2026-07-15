import { type DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InMemoryUserRepository, USER_REPOSITORY } from '../../modules/auth/user.repository.js';
import {
  InMemoryNameChangeRepository,
  NAME_CHANGE_REPOSITORY,
} from '../../modules/auth/name-change.repository.js';
import {
  InMemoryRefreshSessionRepository,
  REFRESH_SESSION_REPOSITORY,
} from '../../modules/auth/refresh-session.repository.js';
import {
  InMemoryPasswordResetRepository,
  PASSWORD_RESET_REPOSITORY,
} from '../../modules/auth/password-reset.repository.js';
import {
  InMemoryPushSubscriptionRepository,
  PUSH_SUBSCRIPTION_REPOSITORY,
} from '../../modules/push/push-subscription.repository.js';
import {
  InMemorySubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from '../../modules/billing/subscription.repository.js';
import { CART_STORE, InMemoryCartStore } from '../../modules/cart/cart.store.js';
import {
  InMemoryProdutoRepository,
  PRODUTO_REPOSITORY,
} from '../../modules/catalog/produtos.repository.js';
import {
  InMemoryPriceObservationRepository,
  PRICE_OBSERVATION_REPOSITORY,
} from '../../modules/pricing/price-observation.repository.js';
import {
  InMemoryNfceImportRepository,
  NFCE_IMPORT_REPOSITORY,
} from '../../modules/nfce/nfce-import.repository.js';
import {
  COMPRA_REPOSITORY,
  InMemoryCompraRepository,
} from '../../modules/compras/compra.repository.js';
import {
  ANALYTICS_REPOSITORY,
  InMemoryAnalyticsRepository,
} from '../../modules/analytics/analytics.repository.js';
import {
  FEEDBACK_REPOSITORY,
  InMemoryFeedbackRepository,
} from '../../modules/feedback/feedback.repository.js';
import { AnalyticsEventEntity } from './entities/analytics-event.entity.js';
import { FeedbackEntity } from './entities/feedback.entity.js';
import { CartEntity, CartItemEntity } from './entities/cart.entity.js';
import { CompraEntity } from './entities/compra.entity.js';
import { NameChangeEntity } from './entities/name-change.entity.js';
import { RefreshSessionEntity } from './entities/refresh-session.entity.js';
import { PasswordResetEntity } from './entities/password-reset.entity.js';
import { PushSubscriptionEntity } from './entities/push-subscription.entity.js';
import { NfceImportEntity } from './entities/nfce-import.entity.js';
import { PriceObservationEntity } from './entities/price-observation.entity.js';
import { ProdutoEntity } from './entities/produto.entity.js';
import { SubscriptionEntity } from './entities/subscription.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { TypeOrmCartRepository } from './repositories/typeorm-cart.repository.js';
import { TypeOrmCompraRepository } from './repositories/typeorm-compra.repository.js';
import { TypeOrmNfceImportRepository } from './repositories/typeorm-nfce-import.repository.js';
import { TypeOrmPriceObservationRepository } from './repositories/typeorm-price-observation.repository.js';
import { TypeOrmProdutoRepository } from './repositories/typeorm-produto.repository.js';
import { TypeOrmSubscriptionRepository } from './repositories/typeorm-subscription.repository.js';
import { TypeOrmUserRepository } from './repositories/typeorm-user.repository.js';
import { TypeOrmNameChangeRepository } from './repositories/typeorm-name-change.repository.js';
import { TypeOrmRefreshSessionRepository } from './repositories/typeorm-refresh-session.repository.js';
import { TypeOrmPasswordResetRepository } from './repositories/typeorm-password-reset.repository.js';
import { TypeOrmPushSubscriptionRepository } from './repositories/typeorm-push-subscription.repository.js';
import { TypeOrmAnalyticsRepository } from './repositories/typeorm-analytics.repository.js';
import { TypeOrmFeedbackRepository } from './repositories/typeorm-feedback.repository.js';

const ENTITIES = [
  UserEntity,
  NameChangeEntity,
  RefreshSessionEntity,
  PasswordResetEntity,
  PushSubscriptionEntity,
  SubscriptionEntity,
  CartEntity,
  CartItemEntity,
  PriceObservationEntity,
  ProdutoEntity,
  NfceImportEntity,
  CompraEntity,
  AnalyticsEventEntity,
  FeedbackEntity,
];
const TOKENS = [
  USER_REPOSITORY,
  NAME_CHANGE_REPOSITORY,
  REFRESH_SESSION_REPOSITORY,
  PASSWORD_RESET_REPOSITORY,
  PUSH_SUBSCRIPTION_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  CART_STORE,
  PRICE_OBSERVATION_REPOSITORY,
  PRODUTO_REPOSITORY,
  NFCE_IMPORT_REPOSITORY,
  COMPRA_REPOSITORY,
  ANALYTICS_REPOSITORY,
  FEEDBACK_REPOSITORY,
];

/**
 * Fornece (globalmente) os repositórios de estado mutável — usuários,
 * assinaturas e carrinhos. Com `DATABASE_URL` → Postgres (TypeORM, dados
 * persistem, funciona em serverless). Sem → memória (dev local sem banco).
 * Os *services* não sabem qual é: dependem só das interfaces.
 */
@Module({})
export class PersistenceModule {
  static forRoot(): DynamicModule {
    const url = process.env.DATABASE_URL;

    if (!url) {
      return {
        module: PersistenceModule,
        global: true,
        providers: [
          { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
          { provide: NAME_CHANGE_REPOSITORY, useClass: InMemoryNameChangeRepository },
          { provide: REFRESH_SESSION_REPOSITORY, useClass: InMemoryRefreshSessionRepository },
          { provide: PASSWORD_RESET_REPOSITORY, useClass: InMemoryPasswordResetRepository },
          { provide: PUSH_SUBSCRIPTION_REPOSITORY, useClass: InMemoryPushSubscriptionRepository },
          { provide: SUBSCRIPTION_REPOSITORY, useClass: InMemorySubscriptionRepository },
          { provide: CART_STORE, useClass: InMemoryCartStore },
          { provide: PRICE_OBSERVATION_REPOSITORY, useClass: InMemoryPriceObservationRepository },
          { provide: PRODUTO_REPOSITORY, useClass: InMemoryProdutoRepository },
          { provide: NFCE_IMPORT_REPOSITORY, useClass: InMemoryNfceImportRepository },
          { provide: COMPRA_REPOSITORY, useClass: InMemoryCompraRepository },
          { provide: ANALYTICS_REPOSITORY, useClass: InMemoryAnalyticsRepository },
          { provide: FEEDBACK_REPOSITORY, useClass: InMemoryFeedbackRepository },
        ],
        exports: TOKENS,
      };
    }

    const synchronize = process.env.DB_SYNCHRONIZE !== 'false';
    return {
      module: PersistenceModule,
      global: true,
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url,
          entities: ENTITIES,
          synchronize, // cria/atualiza tabelas (ok p/ demo)
          ssl: { rejectUnauthorized: false }, // provedores gerenciados (Neon/etc.)
          // Resiliência no boot: o Neon (free) suspende quando ocioso e a conexão
          // pode travar ao "acordar". Fail-fast + retries evitam o boot ficar preso
          // (e o health check do Render dar timeout).
          connectTimeoutMS: 12000,
          retryAttempts: 12,
          retryDelay: 4000,
          keepConnectionAlive: true,
          extra: { max: 5, connectionTimeoutMillis: 12000 },
        }),
        TypeOrmModule.forFeature(ENTITIES),
      ],
      providers: [
        { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
        { provide: NAME_CHANGE_REPOSITORY, useClass: TypeOrmNameChangeRepository },
        { provide: REFRESH_SESSION_REPOSITORY, useClass: TypeOrmRefreshSessionRepository },
        { provide: PASSWORD_RESET_REPOSITORY, useClass: TypeOrmPasswordResetRepository },
        { provide: PUSH_SUBSCRIPTION_REPOSITORY, useClass: TypeOrmPushSubscriptionRepository },
        { provide: SUBSCRIPTION_REPOSITORY, useClass: TypeOrmSubscriptionRepository },
        { provide: CART_STORE, useClass: TypeOrmCartRepository },
        { provide: PRICE_OBSERVATION_REPOSITORY, useClass: TypeOrmPriceObservationRepository },
        { provide: PRODUTO_REPOSITORY, useClass: TypeOrmProdutoRepository },
        { provide: NFCE_IMPORT_REPOSITORY, useClass: TypeOrmNfceImportRepository },
        { provide: COMPRA_REPOSITORY, useClass: TypeOrmCompraRepository },
        { provide: ANALYTICS_REPOSITORY, useClass: TypeOrmAnalyticsRepository },
        { provide: FEEDBACK_REPOSITORY, useClass: TypeOrmFeedbackRepository },
      ],
      exports: TOKENS,
    };
  }
}
