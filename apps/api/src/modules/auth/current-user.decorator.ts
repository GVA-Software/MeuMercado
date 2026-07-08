import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthedUser } from './jwt-auth.guard.js';

/** Injeta o usuário autenticado (setado pelo JwtAuthGuard) no handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    return ctx.switchToHttp().getRequest<{ user: AuthedUser }>().user;
  },
);
