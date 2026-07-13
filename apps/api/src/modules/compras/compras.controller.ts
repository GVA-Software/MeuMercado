import { Controller, Delete, Get, HttpCode, Param, UseGuards } from '@nestjs/common';
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

  /** Exclui TODAS as compras do usuário. */
  @Delete()
  @HttpCode(204)
  excluirTodas(@CurrentUser() user: AuthedUser): Promise<void> {
    return this.service.excluirTodas(user.id);
  }

  /** Exclui UMA compra do usuário. */
  @Delete(':id')
  @HttpCode(204)
  excluir(@Param('id') id: string, @CurrentUser() user: AuthedUser): Promise<void> {
    return this.service.excluir(user.id, id);
  }
}
