import { Global, Module } from '@nestjs/common';
import { buildSeed, type SeedData } from './seed.js';

/** Token de injeção do conjunto de dados de demonstração. */
export const SEED_DATA = 'SEED_DATA';

/**
 * Fornece um ÚNICO conjunto de dados em memória, compartilhado por todos os
 * módulos (catálogo, preços, insights) — assim as observações que a Nina analisa
 * são as mesmas que a tabela de preços mostra. Global para não precisar reimportar.
 *
 * TODO(persistência): trocar por repositórios TypeORM/PostGIS mantendo as mesmas
 * interfaces de repositório — nenhum service muda.
 */
@Global()
@Module({
  providers: [{ provide: SEED_DATA, useFactory: (): SeedData => buildSeed() }],
  exports: [SEED_DATA],
})
export class DataModule {}
