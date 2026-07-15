import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import {
  BrevoEmailService,
  EMAIL_SERVICE,
  GmailEmailService,
  NoopEmailService,
  SmtpEmailService,
  type EmailService,
  type EmailTransporter,
} from './email.service.js';

/** Separa "Nome <email>" em nome + email (o SMTP_FROM vira o remetente). */
function parseFrom(from: string): { nome: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (m) return { nome: m[1]?.trim() || 'Meu Mercado', email: m[2]!.trim() };
  return { nome: 'Meu Mercado', email: from.trim() };
}

/**
 * Provê o EmailService global (config-flip, sem tocar no código), em ordem de preferência:
 *   Gmail API (3 chaves GMAIL_*) → HTTP, DMARC alinhado, chega no iCloud;
 *   senão BREVO_API_KEY → Brevo (HTTP);
 *   senão SMTP_HOST → SMTP (nodemailer); senão → NoopEmailService (só loga).
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SERVICE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService<Env, true>): Promise<EmailService> => {
        const from = config.get('SMTP_FROM', { infer: true });
        const { nome, email } = parseFrom(from);
        const gmailId = config.get('GMAIL_CLIENT_ID', { infer: true });
        const gmailSecret = config.get('GMAIL_CLIENT_SECRET', { infer: true });
        const gmailRefresh = config.get('GMAIL_REFRESH_TOKEN', { infer: true });
        if (gmailId && gmailSecret && gmailRefresh) {
          new Logger('Email').log(`Gmail API ativa — remetente ${email}.`);
          return new GmailEmailService(gmailId, gmailSecret, gmailRefresh, email, nome);
        }
        const brevoKey = config.get('BREVO_API_KEY', { infer: true });
        if (brevoKey) {
          new Logger('Email').log(`Brevo (HTTP) ativo — remetente ${email}.`);
          return new BrevoEmailService(brevoKey, email, nome);
        }
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
