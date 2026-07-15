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
  AdminExcluirProdutosSchema,
  AdminGrantProSchema,
  AdminJuntarMercadosSchema,
  AdminJuntarSchema,
  PageQuerySchema,
  ResponderFeedbackSchema,
  type AdminCoberturaDTO,
  type AdminDuplicadosDTO,
  type AdminExcluirProdutosInput,
  type AdminFunnelDTO,
  type AdminGrantProInput,
  type AdminJuntarInput,
  type AdminJuntarMercadosInput,
  type AdminStatsDTO,
  type AdminUserDTO,
  type AdminUsersResponse,
  type FeedbacksResponse,
  type PageQuery,
  type QaConversaReportDTO,
  type ResponderFeedbackInput,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { FeedbackService } from '../feedback/feedback.service.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly feedback: FeedbackService,
  ) {}

  @Get('feedbacks')
  feedbacks(): Promise<FeedbacksResponse> {
    return this.feedback.listar();
  }

  @Post('feedbacks/:id/responder')
  @HttpCode(204)
  responderFeedback(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResponderFeedbackSchema)) body: ResponderFeedbackInput,
  ): Promise<void> {
    return this.feedback.responder(id, body.resposta);
  }

  /** Envia um e-mail de teste para o próprio ADM — valida a config de SMTP na hora. */
  @Post('test-email')
  testarEmail(@CurrentUser() user: AuthedUser): Promise<{ mensagem: string }> {
    return this.service.testarEmail(user.email);
  }

  @Get('stats')
  stats(): Promise<AdminStatsDTO> {
    return this.service.stats();
  }

  @Get('funil')
  funil(): Promise<AdminFunnelDTO> {
    return this.service.funil();
  }

  /** Painel de cobertura: produtos × mercados cadastrados + quem mais contribui. */
  @Get('cobertura')
  cobertura(): Promise<AdminCoberturaDTO> {
    return this.service.cobertura();
  }

  /** Exclui produtos em lote (some do catálogo e dos apps; apaga os preços). */
  @Post('produtos/excluir')
  excluirProdutos(
    @Body(new ZodValidationPipe(AdminExcluirProdutosSchema)) body: AdminExcluirProdutosInput,
  ): Promise<{ excluidos: number }> {
    return this.service.excluirProdutos(body.ids);
  }

  /** Junta mercados duplicados: move os preços dos removerIds pro manterId. */
  @Post('mercados/juntar')
  juntarMercados(
    @Body(new ZodValidationPipe(AdminJuntarMercadosSchema)) body: AdminJuntarMercadosInput,
  ): Promise<{ mercados: number }> {
    return this.service.juntarMercados(body.manterId, body.removerIds);
  }

  @Get('qa-conversa')
  qaConversa(): Promise<QaConversaReportDTO> {
    return this.service.qaConversa();
  }

  @Get('duplicados')
  duplicados(): Promise<AdminDuplicadosDTO> {
    return this.service.duplicados();
  }

  @Post('duplicados/juntar')
  @HttpCode(204)
  juntar(@Body(new ZodValidationPipe(AdminJuntarSchema)) body: AdminJuntarInput): Promise<void> {
    return this.service.juntarDuplicados(body.manterId, body.removerIds);
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
