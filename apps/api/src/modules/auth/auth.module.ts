import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { TurnstileGuard } from './turnstile.guard.js';
import { Argon2PasswordHasher, PASSWORD_HASHER } from './password.hasher.js';
import { InMemoryUserRepository, USER_REPOSITORY } from './user.repository.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    TurnstileGuard,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
  ],
  // Exporta o que outros módulos precisam para proteger rotas.
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
