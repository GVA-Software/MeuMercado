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
  ConfirmarEmailSchema,
  EsqueciSenhaSchema,
  ExcluirContaSchema,
  GoogleLoginSchema,
  LoginSchema,
  RedefinirSenhaSchema,
  RegisterSchema,
  UpdateNameSchema,
  type AuthResponse,
  type ConfirmarEmailInput,
  type EsqueciSenhaInput,
  type ExcluirContaInput,
  type GoogleLoginInput,
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
import { EmailVerificationService } from './email-verification.service.js';
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
    private readonly verificacao: EmailVerificationService,
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

  /** Confirma o e-mail a partir do token do link. Público (o token é a prova). */
  @Post('confirmar-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  async confirmarEmail(
    @Body(new ZodValidationPipe(ConfirmarEmailSchema)) body: ConfirmarEmailInput,
  ): Promise<void> {
    await this.verificacao.confirmar(body.token);
  }

  /** Reenvia o link de confirmação de e-mail (usuário logado). Sempre 204. */
  @Post('reenviar-verificacao')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  async reenviarVerificacao(@CurrentUser() user: AuthedUser, @Req() req: Request): Promise<void> {
    const base = `${req.protocol}://${req.get('host')}`;
    await this.verificacao.enviarVerificacao(user.id, base);
  }

  // Anti-brute-force/abuso: bem mais restrito que o limite global. Cadastro é raro.
  @Post('register')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @UseGuards(TurnstileGuard)
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.service.register(body);
    // Manda o link de confirmação. Se NÃO há transporte de e-mail, enviarVerificacao
    // marca a conta como verificada e devolve false — então ajustamos o DTO pra não
    // mostrar o banner "confirme seu e-mail" (não há como confirmar sem e-mail).
    const base = `${req.protocol}://${req.get('host')}`;
    const enviado = await this.verificacao.enviarVerificacao(result.response.user.id, base);
    if (!enviado) result.response.user.emailVerificado = true;
    return this.finish(result, res);
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

  /**
   * Login com Google. O ID token já é a prova anti-bot → sem TurnstileGuard.
   * Mesmo cookie httpOnly de refresh do login por senha (via finish()).
   */
  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async google(
    @Body(new ZodValidationPipe(GoogleLoginSchema)) body: GoogleLoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.finish(await this.service.loginComGoogle(body), res);
  }

  /**
   * Callback do fluxo REDIRECT do Google (necessário no PWA instalado do iOS, onde o
   * popup não devolve o token). O Google faz um POST form-urlencoded com `credential`
   * (ID token) + `g_csrf_token`. Verifica o double-submit cookie anti-CSRF, cria a
   * sessão (seta o cookie de refresh) e redireciona pro app — que loga pelo cookie.
   */
  @Post('google/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const body = (req.body ?? {}) as { credential?: string; g_csrf_token?: string };
    const csrfCookie = (req.cookies as Record<string, string> | undefined)?.['g_csrf_token'];
    // Double-submit cookie: o token do corpo TEM que bater com o do cookie do Google.
    if (!body.credential || !body.g_csrf_token || !csrfCookie || body.g_csrf_token !== csrfCookie) {
      res.redirect('/?login=google_erro');
      return;
    }
    try {
      const result = await this.service.loginComGoogle({ idToken: body.credential });
      res.cookie(REFRESH_COOKIE, result.refreshToken, {
        httpOnly: true,
        secure: this.config.get('COOKIE_SECURE', { infer: true }),
        sameSite: 'lax',
        path: REFRESH_PATH,
        maxAge: this.tokens.refreshTtlMs,
      });
      res.redirect('/');
    } catch {
      res.redirect('/?login=google_erro');
    }
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

  /** Registra o reaceite da Política/Termos (quando a versão muda). */
  @Post('aceitar-politica')
  @UseGuards(JwtAuthGuard)
  aceitarPolitica(@CurrentUser() user: AuthedUser): Promise<UserDTO> {
    return this.service.aceitarPolitica(user.id);
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

  /**
   * Exclui a PRÓPRIA conta (soft-delete). Exige a senha atual como confirmação. Os
   * preços cadastrados pelo usuário permanecem na base comunitária. Limpa o cookie.
   */
  @Post('excluir-conta')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  async excluirConta(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(ExcluirContaSchema)) body: ExcluirContaInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.service.excluirConta(user.id, body.senha);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
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
