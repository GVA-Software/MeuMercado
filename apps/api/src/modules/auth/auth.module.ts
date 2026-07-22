import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { TokenService } from './token.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { TurnstileGuard } from './turnstile.guard.js';
import { GoogleTokenVerifier } from './google-token.verifier.js';
import { PASSWORD_HASHER, ScryptPasswordHasher } from './password.hasher.js';

// USER_REPOSITORY é fornecido globalmente pelo PersistenceModule (memória ou Postgres).
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetService,
    TokenService,
    JwtAuthGuard,
    TurnstileGuard,
    GoogleTokenVerifier,
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
  ],
  // Exporta o que outros módulos precisam para proteger rotas.
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
