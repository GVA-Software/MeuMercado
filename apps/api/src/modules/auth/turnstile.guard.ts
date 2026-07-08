import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env.schema.js';

/**
 * Verifica o token do Cloudflare Turnstile (CAPTCHA grátis) contra o anti-bot.
 * Sem `TURNSTILE_SECRET_KEY` (dev), a verificação é pulada com aviso.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  private readonly logger = new Logger(TurnstileGuard.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secret = this.config.get('TURNSTILE_SECRET_KEY', { infer: true });
    if (!secret) {
      this.logger.warn('TURNSTILE_SECRET_KEY ausente — verificação anti-bot desativada (dev).');
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.body as { turnstileToken?: string } | undefined)?.turnstileToken;
    if (!token) throw new ForbiddenException('Turnstile: token ausente');

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success: boolean };
    if (!data.success) throw new ForbiddenException('Turnstile: verificação falhou');
    return true;
  }
}
