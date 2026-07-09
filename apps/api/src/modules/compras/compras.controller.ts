import { Controller, Get, UseGuards } from '@nestjs/common';
import type { ComprasResponse } from '@meumercado/contracts';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { ComprasService } from './compras.service.js';

@Controller('compras')
@UseGuards(JwtAuthGuard)
export class ComprasController {
  constructor(private readonly service: ComprasService) {}

  /** Histórico de compras do usuário logado (mais recentes primeiro). */
  @Get()
  async listar(@CurrentUser() user: AuthedUser): Promise<ComprasResponse> {
    return { compras: await this.service.listar(user.id) };
  }
}
