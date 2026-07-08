import { type DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InMemoryUserRepository, USER_REPOSITORY } from '../../modules/auth/user.repository.js';
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
import { CartEntity, CartItemEntity } from './entities/cart.entity.js';
import { NfceImportEntity } from './entities/nfce-import.entity.js';
import { PriceObservationEntity } from './entities/price-observation.entity.js';
import { ProdutoEntity } from './entities/produto.entity.js';
import { SubscriptionEntity } from './entities/subscription.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { TypeOrmCartRepository } from './repositories/typeorm-cart.repository.js';
import { TypeOrmNfceImportRepository } from './repositories/typeorm-nfce-import.repository.js';
import { TypeOrmPriceObservationRepository } from './repositories/typeorm-price-observation.repository.js';
import { TypeOrmProdutoRepository } from './repositories/typeorm-produto.repository.js';
import { TypeOrmSubscriptionRepository } from './repositories/typeorm-subscription.repository.js';
import { TypeOrmUserRepository } from './repositories/typeorm-user.repository.js';

const ENTITIES = [
  UserEntity,
  SubscriptionEntity,
  CartEntity,
  CartItemEntity,
  PriceObservationEntity,
  ProdutoEntity,
  NfceImportEntity,
];
const TOKENS = [
  USER_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  CART_STORE,
  PRICE_OBSERVATION_REPOSITORY,
  PRODUTO_REPOSITORY,
  NFCE_IMPORT_REPOSITORY,
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
          { provide: SUBSCRIPTION_REPOSITORY, useClass: InMemorySubscriptionRepository },
          { provide: CART_STORE, useClass: InMemoryCartStore },
          { provide: PRICE_OBSERVATION_REPOSITORY, useClass: InMemoryPriceObservationRepository },
          { provide: PRODUTO_REPOSITORY, useClass: InMemoryProdutoRepository },
          { provide: NFCE_IMPORT_REPOSITORY, useClass: InMemoryNfceImportRepository },
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
        { provide: SUBSCRIPTION_REPOSITORY, useClass: TypeOrmSubscriptionRepository },
        { provide: CART_STORE, useClass: TypeOrmCartRepository },
        { provide: PRICE_OBSERVATION_REPOSITORY, useClass: TypeOrmPriceObservationRepository },
        { provide: PRODUTO_REPOSITORY, useClass: TypeOrmProdutoRepository },
        { provide: NFCE_IMPORT_REPOSITORY, useClass: TypeOrmNfceImportRepository },
      ],
      exports: TOKENS,
    };
  }
}
