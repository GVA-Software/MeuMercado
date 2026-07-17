import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { DadosPessoaisService } from './dados-pessoais.service.js';

@Controller('privacidade')
@UseGuards(JwtAuthGuard)
export class PrivacyController {
  constructor(private readonly service: DadosPessoaisService) {}

  /** Portabilidade LGPD: baixa TODOS os dados do titular logado em JSON. */
  @Get('meus-dados')
  meusDados(@CurrentUser() user: AuthedUser): Promise<Record<string, unknown>> {
    return this.service.exportar(user.id);
  }
}
