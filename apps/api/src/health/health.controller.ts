import { Controller, Get, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  // @Optional: em modo sem-banco (dev local sem DATABASE_URL) não há DataSource.
  constructor(@Optional() @InjectDataSource() private readonly dataSource?: DataSource) {}

  /** Liveness simples (NÃO toca o banco) — para probes de infra e keep-warm do web. */
  @Get()
  check(): { status: 'ok'; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness que ACORDA o banco (Neon free suspende quando ocioso). O keep-warm bate
   * aqui pra o 1º acesso do usuário não pagar os ~45s de cold start do Postgres.
   */
  @Get('db')
  async db(): Promise<{ status: 'ok' | 'degraded'; db: string }> {
    if (!this.dataSource) return { status: 'ok', db: 'sem-banco' };
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'quente' };
    } catch {
      return { status: 'degraded', db: 'frio-ou-erro' };
    }
  }
}
