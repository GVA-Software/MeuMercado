import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminClassificarSchema,
  AdminEditarPrecoSchema,
  AdminEditarProdutoSchema,
  AdminEditarMercadoSchema,
  AdminExcluirMercadosSchema,
  AdminExcluirProdutosSchema,
  AdminGrantProSchema,
  AdminJuntarMercadosSchema,
  AdminJuntarSchema,
  AdminSepararPrecoSchema,
  PageQuerySchema,
  ResponderFeedbackSchema,
  type AdminClassificarInput,
  type AdminCoberturaDTO,
  type AdminDuplicadosDTO,
  type AdminEditarPrecoInput,
  type AdminEditarProdutoInput,
  type AdminEditarMercadoInput,
  type AdminExcluirMercadosInput,
  type AdminExcluirProdutosInput,
  type AdminFunnelDTO,
  type AdminGrantProInput,
  type AdminJuntarInput,
  type AdminJuntarMercadosInput,
  type AdminProdutoEdicaoDTO,
  type AdminSepararPrecoInput,
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

  /** Classifica produtos em lote (define a categoria de vários de uma vez). */
  @Post('produtos/categoria')
  classificarProdutos(
    @Body(new ZodValidationPipe(AdminClassificarSchema)) body: AdminClassificarInput,
  ): Promise<{ classificados: number }> {
    return this.service.classificarProdutos(body.ids, body.categoria);
  }

  /** Auto-classifica os produtos que estão em "Outros" pela heurística de nome. */
  @Post('produtos/auto-classificar')
  autoClassificar(): Promise<{ classificados: number; porCategoria: Record<string, number> }> {
    return this.service.autoClassificar();
  }

  /** Junta mercados duplicados: move os preços dos removerIds pro manterId. */
  @Post('mercados/juntar')
  juntarMercados(
    @Body(new ZodValidationPipe(AdminJuntarMercadosSchema)) body: AdminJuntarMercadosInput,
  ): Promise<{ mercados: number }> {
    return this.service.juntarMercados(body.manterId, body.removerIds);
  }

  /** Exclui mercados: apaga todos os preços deles (some da comparação nos apps). */
  @Post('mercados/excluir')
  excluirMercados(
    @Body(new ZodValidationPipe(AdminExcluirMercadosSchema)) body: AdminExcluirMercadosInput,
  ): Promise<{ mercados: number; precos: number }> {
    return this.service.excluirMercados(body.ids);
  }

  /** Edita nome/endereço de um mercado (limpa a coord → mapa re-geocodifica). */
  @Post('mercados/editar')
  @HttpCode(204)
  editarMercado(
    @Body(new ZodValidationPipe(AdminEditarMercadoSchema)) body: AdminEditarMercadoInput,
  ): Promise<void> {
    return this.service.editarMercado(body.mercadoId, body.nome, body.endereco);
  }

  /** Dados de um produto + seus reportes de preço (para o editor). */
  @Get('produtos/:id/edicao')
  produtoEdicao(@Param('id') id: string): Promise<AdminProdutoEdicaoDTO> {
    return this.service.produtoEdicao(id);
  }

  /** Edita nome/categoria de um produto. */
  @Patch('produtos/:id')
  @HttpCode(204)
  editarProduto(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AdminEditarProdutoSchema)) body: AdminEditarProdutoInput,
  ): Promise<void> {
    return this.service.editarProduto(id, body.nome, body.categoria);
  }

  /** Corrige o valor de um reporte de preço. */
  @Patch('precos/:id')
  @HttpCode(204)
  editarPreco(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AdminEditarPrecoSchema)) body: AdminEditarPrecoInput,
  ): Promise<void> {
    return this.service.editarPreco(id, body.precoCents);
  }

  /** Exclui um reporte de preço (report errado). */
  @Delete('precos/:id')
  @HttpCode(204)
  excluirPreco(@Param('id') id: string): Promise<void> {
    return this.service.excluirPreco(id);
  }

  /** Separa um reporte num produto novo (gramaturas que ficaram juntas). */
  @Post('precos/:id/separar')
  @HttpCode(204)
  separarPreco(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AdminSepararPrecoSchema)) body: AdminSepararPrecoInput,
  ): Promise<void> {
    return this.service.separarPreco(id, body.nome);
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
