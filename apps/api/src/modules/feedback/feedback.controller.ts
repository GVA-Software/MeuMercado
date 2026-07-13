import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CreateFeedbackSchema, type CreateFeedbackInput } from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { FeedbackService } from './feedback.service.js';

/** Usuário envia feedback (bug/sugestão/elogio). O ADM responde pelo painel. */
@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Post()
  @HttpCode(204)
  criar(
    @Body(new ZodValidationPipe(CreateFeedbackSchema)) body: CreateFeedbackInput,
    @CurrentUser() user: AuthedUser,
  ): Promise<void> {
    return this.service.criar(user.id, user.email, body);
  }
}
