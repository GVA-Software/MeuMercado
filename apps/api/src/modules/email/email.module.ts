import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import {
  EMAIL_SERVICE,
  NoopEmailService,
  SmtpEmailService,
  type EmailService,
  type EmailTransporter,
} from './email.service.js';

/**
 * Provê o EmailService global. SEM `SMTP_HOST` → NoopEmailService (só loga).
 * COM → SMTP via nodemailer (carregado sob demanda). É um config-flip: basta
 * setar as envs SMTP_* que o e-mail passa a sair, sem tocar no código.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SERVICE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService<Env, true>): Promise<EmailService> => {
        const host = config.get('SMTP_HOST', { infer: true });
        if (!host) return new NoopEmailService();
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host,
          port: config.get('SMTP_PORT', { infer: true }),
          secure: config.get('SMTP_PORT', { infer: true }) === 465,
          auth: {
            user: config.get('SMTP_USER', { infer: true }),
            pass: config.get('SMTP_PASS', { infer: true }),
          },
          // Sem isto o sendMail fica PENDURADO se o SMTP não responder (config
          // errada/porta bloqueada) — e o botão "Testar" trava em "Enviando…".
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
        }) as unknown as EmailTransporter;
        new Logger('Email').log(`SMTP ativo (${host}).`);
        return new SmtpEmailService(transporter, config.get('SMTP_FROM', { infer: true }));
      },
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
