import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  NfceImportRequestSchema,
  NfcePreviewRequestSchema,
  type NfceDraftDTO,
  type NfceImportRequest,
  type NfceImportResult,
  type NfcePreviewRequest,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { NfceService } from './nfce.service.js';

@Controller('nfce')
@UseGuards(JwtAuthGuard)
export class NfceController {
  constructor(private readonly service: NfceService) {}

  /** Lê o cupom (URL do QR) e devolve o rascunho dos itens para revisão. */
  @Post('preview')
  preview(
    @Body(new ZodValidationPipe(NfcePreviewRequestSchema)) body: NfcePreviewRequest,
  ): Promise<NfceDraftDTO> {
    return this.service.preview(body.url);
  }

  /** Importa os itens confirmados: cria produtos novos + observações de preço. */
  @Post('importar')
  @HttpCode(201)
  importar(
    @Body(new ZodValidationPipe(NfceImportRequestSchema)) body: NfceImportRequest,
    @CurrentUser() user: AuthedUser,
  ): Promise<NfceImportResult> {
    return this.service.importar(body, user.id);
  }
}
