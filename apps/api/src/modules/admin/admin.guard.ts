import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAdminEmail } from '../../common/admin-emails.js';
import type { Env } from '../../config/env.schema.js';
import type { AuthedUser } from '../auth/jwt-auth.guard.js';

/**
 * Libera a rota só para administradores (allowlist de e-mails). Use SEMPRE depois
 * do JwtAuthGuard: `@UseGuards(JwtAuthGuard, AdminGuard)`. O gating é no servidor.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthedUser }>();
    if (!req.user) throw new ForbiddenException('Autenticação necessária');
    if (!isAdminEmail(req.user.email, this.config.get('ADMIN_EMAILS', { infer: true }))) {
      throw new ForbiddenException('Acesso restrito à administração');
    }
    return true;
  }
}
