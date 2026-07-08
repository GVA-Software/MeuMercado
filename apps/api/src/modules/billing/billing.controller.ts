import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SubscribeSchema, type SubscribeInput, type SubscriptionDTO } from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { BillingService } from './billing.service.js';
import { ProGuard } from './pro.guard.js';

@Controller('billing')
@UseGuards(JwtAuthGuard) // toda rota aqui exige login
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('me')
  async minha(@CurrentUser() user: AuthedUser): Promise<SubscriptionDTO> {
    return this.service.toDTO(await this.service.forUser(user.id));
  }

  @Post('trial')
  async trial(@CurrentUser() user: AuthedUser): Promise<SubscriptionDTO> {
    return this.service.toDTO(await this.service.iniciarTrial(user.id));
  }

  @Post('subscribe')
  async assinar(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(SubscribeSchema)) body: SubscribeInput,
  ): Promise<SubscriptionDTO> {
    return this.service.toDTO(await this.service.assinar(user.id, body.periodo));
  }

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
