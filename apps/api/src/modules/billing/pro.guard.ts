import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthedUser } from '../auth/jwt-auth.guard.js';
import { BillingService } from './billing.service.js';

/**
 * Libera a rota apenas para usuários com Pro ativo. Use SEMPRE depois do
 * JwtAuthGuard: `@UseGuards(JwtAuthGuard, ProGuard)`. O gating acontece no
 * servidor (nunca confie só no front para esconder o botão).
 */
@Injectable()
export class ProGuard implements CanActivate {
  constructor(private readonly billing: BillingService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthedUser }>();
    if (!req.user) throw new ForbiddenException('Autenticação necessária');
    if (!this.billing.isProAtivo(req.user.id)) {
      throw new ForbiddenException('Recurso exclusivo do Pro');
    }
    return true;
  }
}
