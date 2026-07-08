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
  minha(@CurrentUser() user: AuthedUser): SubscriptionDTO {
    return this.service.toDTO(this.service.forUser(user.id));
  }

  @Post('trial')
  trial(@CurrentUser() user: AuthedUser): SubscriptionDTO {
    return this.service.toDTO(this.service.iniciarTrial(user.id));
  }

  @Post('subscribe')
  assinar(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(SubscribeSchema)) body: SubscribeInput,
  ): SubscriptionDTO {
    return this.service.toDTO(this.service.assinar(user.id, body.periodo));
  }

  @Post('cancel')
  cancelar(@CurrentUser() user: AuthedUser): SubscriptionDTO {
    return this.service.toDTO(this.service.cancelar(user.id));
  }

  /** Exemplo de recurso exclusivo do Pro (prova o ProGuard no servidor). */
  @Get('pro-only')
  @UseGuards(ProGuard)
  proOnly(): { message: string } {
    return { message: 'Conteúdo exclusivo do Pro 🎉' };
  }
}
