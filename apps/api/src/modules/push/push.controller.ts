import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { PushService } from './push.service.js';

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
const UnsubscribeSchema = z.object({ endpoint: z.string().url() });

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly service: PushService) {}

  /** Chave pública VAPID para o navegador se inscrever. */
  @Get('public-key')
  publicKey(): { publicKey: string } {
    return { publicKey: this.service.chavePublica() };
  }

  @Post('subscribe')
  @HttpCode(204)
  async subscribe(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(SubscriptionSchema)) body: z.infer<typeof SubscriptionSchema>,
  ): Promise<void> {
    await this.service.inscrever(user.id, body);
  }

  @Delete('subscribe')
  @HttpCode(204)
  async unsubscribe(
    @Body(new ZodValidationPipe(UnsubscribeSchema)) body: z.infer<typeof UnsubscribeSchema>,
  ): Promise<void> {
    await this.service.desinscrever(body.endpoint);
  }
}
