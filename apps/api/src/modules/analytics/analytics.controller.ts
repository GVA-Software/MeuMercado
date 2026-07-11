import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { TrackEventSchema, type TrackEventInput } from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { AnalyticsService } from './analytics.service.js';

/** Coleta de eventos (própria). Só nomes da whitelist (validados pelo schema). */
@Controller('events')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Post()
  @HttpCode(204)
  async track(
    @Body(new ZodValidationPipe(TrackEventSchema)) body: TrackEventInput,
    @CurrentUser() user: AuthedUser,
  ): Promise<void> {
    await this.service.registrar(body.name, user.id, body.props);
  }
}
