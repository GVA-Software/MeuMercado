import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  SaveListSchema,
  type SaveListInput,
  type SavedListDTO,
  type SavedListsResponse,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { ListasService } from './listas.service.js';

/** Listas salvas do usuário (modelos reutilizáveis). Escopadas ao dono. */
@Controller('listas')
@UseGuards(JwtAuthGuard)
export class ListasController {
  constructor(private readonly service: ListasService) {}

  @Post()
  @HttpCode(201)
  salvar(
    @Body(new ZodValidationPipe(SaveListSchema)) body: SaveListInput,
    @CurrentUser() user: AuthedUser,
  ): Promise<SavedListDTO> {
    return this.service.salvar(user.id, body.nome, body.itens);
  }

  @Get()
  async listar(@CurrentUser() user: AuthedUser): Promise<SavedListsResponse> {
    return { listas: await this.service.listar(user.id) };
  }

  @Delete(':id')
  @HttpCode(204)
  excluir(@Param('id') id: string, @CurrentUser() user: AuthedUser): Promise<void> {
    return this.service.excluir(user.id, id);
  }
}
