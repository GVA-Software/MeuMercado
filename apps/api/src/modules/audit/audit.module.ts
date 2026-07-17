import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AccessLogInterceptor } from './access-log.interceptor.js';

/**
 * Auditoria de acessos (art. 15 do Marco Civil). Registra as mutações num log
 * append-only via interceptor GLOBAL. O ACCESS_LOG_REPOSITORY vem do
 * PersistenceModule (global): memória em dev, Postgres em produção.
 */
@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor }],
})
export class AuditModule {}
