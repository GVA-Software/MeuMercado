import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ListasController } from './listas.controller.js';
import { ListasService } from './listas.service.js';

/** Listas salvas (modelos reutilizáveis). AuthModule → JwtAuthGuard (TokenService);
 *  o repositório vem do PersistenceModule (global). */
@Module({
  imports: [AuthModule],
  controllers: [ListasController],
  providers: [ListasService],
  exports: [ListasService],
})
export class ListasModule {}
