import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrivacyController } from './privacy.controller.js';
import { DadosPessoaisService } from './dados-pessoais.service.js';

/**
 * Portabilidade de dados (LGPD art. 18, V). Os repositórios agregados são todos
 * globais (PersistenceModule). Importa AuthModule pelo JwtAuthGuard.
 */
@Module({
  imports: [AuthModule],
  controllers: [PrivacyController],
  providers: [DadosPessoaisService],
})
export class PrivacyModule {}
