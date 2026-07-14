import { Injectable, Logger } from '@nestjs/common';

/** Envio de e-mail — plugável. Sem SMTP configurado, vira no-op (só loga). */
export interface EmailService {
  /** Best-effort: nunca lança (o push já avisou). */
  enviar(para: string, assunto: string, corpo: string): Promise<void>;
  /** Há SMTP configurado? (senão os e-mails são no-op) */
  estaLigado(): boolean;
  /** Envia um e-mail de teste e LANÇA se falhar — usado pelo ADM para validar a config. */
  enviarTeste(para: string): Promise<void>;
}

export const EMAIL_SERVICE = 'EMAIL_SERVICE';

/** Transporte mínimo (o do nodemailer encaixa estruturalmente). */
export interface EmailTransporter {
  sendMail(opts: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

@Injectable()
export class NoopEmailService implements EmailService {
  private readonly logger = new Logger('Email');
  enviar(para: string, assunto: string): Promise<void> {
    this.logger.log(`E-mail DESLIGADO (sem SMTP). Não enviei p/ ${para}: "${assunto}"`);
    return Promise.resolve();
  }
  estaLigado(): boolean {
    return false;
  }
  enviarTeste(): Promise<void> {
    return Promise.reject(
      new Error('E-mail desligado — configure SMTP_HOST, SMTP_USER e SMTP_PASS no Render.'),
    );
  }
}

export class SmtpEmailService implements EmailService {
  private readonly logger = new Logger('Email');
  constructor(
    private readonly transporter: EmailTransporter,
    private readonly from: string,
  ) {}

  async enviar(para: string, assunto: string, corpo: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to: para, subject: assunto, text: corpo });
    } catch (e) {
      // E-mail é best-effort (o push já avisou); não derruba a operação.
      this.logger.warn(`Falha ao enviar e-mail p/ ${para}: ${String(e)}`);
    }
  }

  estaLigado(): boolean {
    return true;
  }

  /** Sem try/catch de propósito: o ADM precisa ver o erro se a config estiver errada. */
  async enviarTeste(para: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: para,
      subject: 'Teste de e-mail — Meu Mercado',
      text: 'Se você recebeu este e-mail, o envio por SMTP está funcionando. 🧡\n\n— Meu Mercado',
    });
  }
}
