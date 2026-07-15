import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  EsqueciSenhaSchema,
  LoginSchema,
  RedefinirSenhaSchema,
  RegisterSchema,
  UpdateNameSchema,
  type AuthResponse,
  type EsqueciSenhaInput,
  type LoginInput,
  type RedefinirSenhaInput,
  type RegisterInput,
  type UpdateNameInput,
  type UserDTO,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.schema.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { PasswordResetService } from './password-reset.service.js';
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
    private readonly resets: PasswordResetService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Pede recuperação: manda o link por e-mail. Sempre 204 (não revela e-mails). */
  @Post('esqueci-senha')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  async esqueciSenha(
    @Body(new ZodValidationPipe(EsqueciSenhaSchema)) body: EsqueciSenhaInput,
    @Req() req: Request,
  ): Promise<void> {
    const base = `${req.protocol}://${req.get('host')}`;
    await this.resets.esqueciSenha(body.email, base);
  }

  /** Redefine a senha a partir do token do e-mail. */
  @Post('redefinir-senha')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  async redefinirSenha(
    @Body(new ZodValidationPipe(RedefinirSenhaSchema)) body: RedefinirSenhaInput,
  ): Promise<void> {
    await this.resets.redefinirSenha(body.token, body.senha);
  }

  // Anti-brute-force/abuso: bem mais restrito que o limite global. Cadastro é raro.
  @Post('register')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @UseGuards(TurnstileGuard)
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.finish(await this.service.register(body), res);
  }

  // Anti-brute-force de senha: 10 tentativas/min por IP (vs. 120 do limite global).
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(TurnstileGuard)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.finish(await this.service.login(body), res);
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Refresh ausente');
    let payload: { sub: string; jti?: string };
    try {
      payload = this.tokens.verifyRefresh(token);
    } catch {
      throw new UnauthorizedException('Refresh inválido');
    }
    return this.finish(await this.service.refresh(payload.sub, payload.jti), res);
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    // Revoga a sessão no servidor (não só apaga o cookie) — um refresh vazado deixa
    // de valer imediatamente após o logout.
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (token) {
      try {
        await this.service.logout(this.tokens.verifyRefresh(token).jti);
      } catch {
        /* cookie inválido/expirado: nada a revogar */
      }
    }
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthedUser): Promise<UserDTO> {
    return this.service.me(user.id);
  }

  /** Atualiza o próprio nome (o e-mail não muda). */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  atualizar(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(UpdateNameSchema)) body: UpdateNameInput,
  ): Promise<UserDTO> {
    return this.service.updateNome(user.id, body.nome);
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
