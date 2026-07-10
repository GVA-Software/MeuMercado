import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { type SubscriptionDTO } from '@meumercado/contracts';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { BillingService } from './billing.service.js';
import { ProGuard } from './pro.guard.js';

@Controller('billing')
@UseGuards(JwtAuthGuard) // toda rota aqui exige login
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('me')
  minha(@CurrentUser() user: AuthedUser): Promise<SubscriptionDTO> {
    return this.service.minhaComExpiracao(user.id);
  }

  // A concessão de Pro / Nina IA (trial ou assinatura) é feita SOMENTE pelo painel
  // de administração (AdminService → BillingService). O app não pode se auto-conceder
  // — por isso não há mais /billing/trial nem /billing/subscribe aqui.

  @Post('cancel')
  async cancelar(@CurrentUser() user: AuthedUser): Promise<SubscriptionDTO> {
    return this.service.toDTO(await this.service.cancelar(user.id));
  }

  /** Exemplo de recurso exclusivo do Pro (prova o ProGuard no servidor). */
  @Get('pro-only')
  @UseGuards(ProGuard)
  proOnly(): { message: string } {
    return { message: 'Conteúdo exclusivo do Pro 🎉' };
  }
}
