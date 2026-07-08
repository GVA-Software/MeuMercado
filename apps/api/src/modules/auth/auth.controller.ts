import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  LoginSchema,
  RegisterSchema,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
  type UserDTO,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.schema.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from './jwt-auth.guard.js';
import { TokenService } from './token.service.js';
import { TurnstileGuard } from './turnstile.guard.js';

const REFRESH_COOKIE = 'mm_refresh';
const REFRESH_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('register')
  @UseGuards(TurnstileGuard)
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.finish(await this.service.register(body), res);
  }

  @Post('login')
  @UseGuards(TurnstileGuard)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.finish(await this.service.login(body), res);
  }

  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): AuthResponse {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Refresh ausente');
    let sub: string;
    try {
      sub = this.tokens.verifyRefresh(token).sub;
    } catch {
      throw new UnauthorizedException('Refresh inválido');
    }
    return this.finish(this.service.refresh(sub), res);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthedUser): UserDTO {
    return this.service.me(user.id);
  }

  /** Seta o refresh token em cookie httpOnly (não acessível ao JS do front). */
  private finish(result: AuthResult, res: Response): AuthResponse {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: REFRESH_PATH,
      maxAge: this.tokens.refreshTtlMs,
    });
    return result.response;
  }
}
