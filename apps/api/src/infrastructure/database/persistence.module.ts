import { type DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InMemoryUserRepository, USER_REPOSITORY } from '../../modules/auth/user.repository.js';
import {
  InMemorySubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from '../../modules/billing/subscription.repository.js';
import { CART_STORE, InMemoryCartStore } from '../../modules/cart/cart.store.js';
import { CartEntity, CartItemEntity } from './entities/cart.entity.js';
import { SubscriptionEntity } from './entities/subscription.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { TypeOrmCartRepository } from './repositories/typeorm-cart.repository.js';
import { TypeOrmSubscriptionRepository } from './repositories/typeorm-subscription.repository.js';
import { TypeOrmUserRepository } from './repositories/typeorm-user.repository.js';

const ENTITIES = [UserEntity, SubscriptionEntity, CartEntity, CartItemEntity];
const TOKENS = [USER_REPOSITORY, SUBSCRIPTION_REPOSITORY, CART_STORE];

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
        }),
        TypeOrmModule.forFeature(ENTITIES),
      ],
      providers: [
        { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
        { provide: SUBSCRIPTION_REPOSITORY, useClass: TypeOrmSubscriptionRepository },
        { provide: CART_STORE, useClass: TypeOrmCartRepository },
      ],
      exports: TOKENS,
    };
  }
}
