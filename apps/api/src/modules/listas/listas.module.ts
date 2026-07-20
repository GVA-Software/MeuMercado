import { Module } from '@nestjs/common';
import { ListasController } from './listas.controller.js';
import { ListasService } from './listas.service.js';

/** Listas salvas (modelos reutilizáveis). O repositório vem do PersistenceModule (global). */
@Module({
  controllers: [ListasController],
  providers: [ListasService],
  exports: [ListasService],
})
export class ListasModule {}
