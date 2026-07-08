import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, InvalidCartError } from '@meumercado/domain';

/**
 * Filtro global único. Traduz qualquer exceção em uma resposta JSON consistente:
 * - `HttpException` (ex.: 400/404 do Nest): repassa status e corpo.
 * - `DomainError` (regras de negócio violadas): 4xx com a mensagem de domínio.
 * - Qualquer outra: 500 **genérico** — nunca vazamos stack/detalhes internos ao
 *   cliente (o erro real vai só para o log do servidor).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      error: 'InternalServerError',
      message: 'Erro interno',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body = typeof resp === 'string' ? { message: resp } : (resp as Record<string, unknown>);
    } else if (exception instanceof DomainError) {
      // Conflito de estado (ex.: linha duplicada) → 409; demais violações → 422.
      status =
        exception instanceof InvalidCartError
          ? HttpStatus.CONFLICT
          : HttpStatus.UNPROCESSABLE_ENTITY;
      body = { error: exception.name, message: exception.message };
    } else {
      // Erro inesperado: loga o real, responde genérico.
      this.logger.error(
        `Erro não tratado em ${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      ...body,
    });
  }
}
