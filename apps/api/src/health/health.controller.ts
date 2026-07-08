import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /** Liveness/readiness simples para probes de infra (Docker/Cloudflare/LB). */
  @Get()
  check(): { status: 'ok'; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
