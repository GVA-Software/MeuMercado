import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminGrantProSchema,
  PageQuerySchema,
  type AdminFunnelDTO,
  type AdminGrantProInput,
  type AdminStatsDTO,
  type AdminUserDTO,
  type AdminUsersResponse,
  type PageQuery,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('stats')
  stats(): Promise<AdminStatsDTO> {
    return this.service.stats();
  }

  @Get('funil')
  funil(): Promise<AdminFunnelDTO> {
    return this.service.funil();
  }

  @Get('users')
  listar(
    @Query(new ZodValidationPipe(PageQuerySchema)) query: PageQuery,
  ): Promise<AdminUsersResponse> {
    return this.service.listar(query.limit, query.offset);
  }

  @Delete('users/:id')
  @HttpCode(204)
  excluir(@Param('id') id: string, @CurrentUser() user: AuthedUser): Promise<void> {
    return this.service.excluir(id, user);
  }

  @Post('users/:id/trial')
  trial(@Param('id') id: string): Promise<AdminUserDTO> {
    return this.service.concederTrial(id);
  }

  @Post('users/:id/pro')
  pro(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AdminGrantProSchema)) body: AdminGrantProInput,
  ): Promise<AdminUserDTO> {
    return this.service.concederPro(id, body.periodo);
  }

  @Post('users/:id/revoke')
  revoke(@Param('id') id: string): Promise<AdminUserDTO> {
    return this.service.revogar(id);
  }
}
