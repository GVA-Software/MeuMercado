import { Injectable, Logger } from '@nestjs/common';

/** Envio de e-mail — plugável. Sem SMTP configurado, vira no-op (só loga). */
export interface EmailService {
  /**
   * Best-effort: nunca lança (o push já avisou). `corpo` é o texto puro (fallback);
   * `html` é opcional (quando presente, vai como multipart/alternative).
   */
  enviar(para: string, assunto: string, corpo: string, html?: string): Promise<void>;
  /** Há SMTP configurado? (senão os e-mails são no-op) */
  estaLigado(): boolean;
  /** Envia um e-mail de teste e LANÇA se falhar — usado pelo ADM para validar a config. */
  enviarTeste(para: string): Promise<void>;
}

export const EMAIL_SERVICE = 'EMAIL_SERVICE';

/** Transporte mínimo (o do nodemailer encaixa estruturalmente). */
export interface EmailTransporter {
  sendMail(opts: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<unknown>;
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
      new Error('E-mail desligado — configure BREVO_API_KEY (ou SMTP_*) no Render.'),
    );
  }
}

/**
 * Envio via Brevo (HTTP, porta 443). Contorna o bloqueio de SMTP de saída do Render
 * free. Só precisa de `BREVO_API_KEY` e de um remetente verificado no Brevo.
 */
export class BrevoEmailService implements EmailService {
  private readonly logger = new Logger('Email');
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {}

  private async send(para: string, assunto: string, corpo: string, html?: string): Promise<void> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.fromEmail, name: this.fromName },
        to: [{ email: para }],
        subject: assunto,
        textContent: corpo,
        ...(html ? { htmlContent: html } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      throw new Error(`Brevo ${res.status}: ${detalhe.slice(0, 300)}`);
    }
  }

  async enviar(para: string, assunto: string, corpo: string, html?: string): Promise<void> {
    try {
      await this.send(para, assunto, corpo, html);
    } catch (e) {
      // Best-effort (o push já avisou); não derruba a operação.
      this.logger.warn(`Falha ao enviar e-mail p/ ${para}: ${String(e)}`);
    }
  }

  estaLigado(): boolean {
    return true;
  }

  /** Sem try/catch: o ADM precisa ver o erro se a config estiver errada. */
  async enviarTeste(para: string): Promise<void> {
    await this.send(
      para,
      'Teste de e-mail — Meu Mercado',
      'Se você recebeu este e-mail, o envio pelo Brevo está funcionando. 🧡\n\n— Meu Mercado',
    );
  }
}

/**
 * Envio via **Gmail API** (HTTP, porta 443). Envia pela própria conta Gmail, então
 * SPF/DKIM/DMARC alinham com o gmail.com e provedores rígidos (iCloud/Apple) aceitam —
 * ao contrário do remetente compartilhado do Brevo, que o iCloud recusa por DMARC.
 * Precisa de um OAuth client (id+secret) e de um refresh token da conta remetente.
 */
export class GmailEmailService implements EmailService {
  private readonly logger = new Logger('Email');
  private accessToken: string | null = null;
  private expiraEm = 0; // epoch ms de expiração do access token (com folga)

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {}

  /** Troca o refresh token por um access token (cacheado até ~1min antes de expirar). */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiraEm) return this.accessToken;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      throw new Error(`Gmail OAuth ${res.status}: ${detalhe.slice(0, 300)}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = json.access_token;
    this.expiraEm = Date.now() + (json.expires_in - 60) * 1000;
    return this.accessToken;
  }

  /** Codifica um cabeçalho com acentos como encoded-word RFC 2047 (senão passa direto). */
  private encodeWord(s: string): string {
    // Qualquer caractere fora do ASCII (> 0x7F) exige encoding no cabeçalho.
    return Array.from(s).some((c) => c.charCodeAt(0) > 0x7f)
      ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`
      : s;
  }

  /** Codifica em base64 quebrando em linhas de 76 (RFC 2045). */
  private b64(s: string): string {
    return Buffer.from(s, 'utf8')
      .toString('base64')
      .replace(/(.{76})/g, '$1\r\n');
  }

  /**
   * Monta a mensagem RFC 822 e devolve em base64url (campo `raw`). Com `html`, envia
   * multipart/alternative (texto puro + HTML) — o cliente escolhe o que renderiza.
   */
  private buildRaw(para: string, assunto: string, corpo: string, html?: string): string {
    const headers = [
      `From: ${this.encodeWord(this.fromName)} <${this.fromEmail}>`,
      `To: ${para}`,
      `Subject: ${this.encodeWord(assunto)}`,
      'MIME-Version: 1.0',
    ];
    let mime: string;
    if (html) {
      const b = '----=_MeuMercado_alt';
      headers.push(`Content-Type: multipart/alternative; boundary="${b}"`);
      mime = [
        `--${b}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        this.b64(corpo),
        `--${b}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        this.b64(html),
        `--${b}--`,
      ].join('\r\n');
    } else {
      headers.push(
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
      );
      mime = this.b64(corpo);
    }
    const raw = `${headers.join('\r\n')}\r\n\r\n${mime}`;
    return Buffer.from(raw, 'utf8').toString('base64url');
  }

  private async send(para: string, assunto: string, corpo: string, html?: string): Promise<void> {
    const token = await this.getAccessToken();
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ raw: this.buildRaw(para, assunto, corpo, html) }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      throw new Error(`Gmail ${res.status}: ${detalhe.slice(0, 300)}`);
    }
  }

  async enviar(para: string, assunto: string, corpo: string, html?: string): Promise<void> {
    try {
      await this.send(para, assunto, corpo, html);
    } catch (e) {
      // Best-effort (o push já avisou); não derruba a operação.
      this.logger.warn(`Falha ao enviar e-mail p/ ${para}: ${String(e)}`);
    }
  }

  estaLigado(): boolean {
    return true;
  }

  /** Sem try/catch: o ADM precisa ver o erro se a config estiver errada. */
  async enviarTeste(para: string): Promise<void> {
    await this.send(
      para,
      'Teste de e-mail — Meu Mercado',
      'Se você recebeu este e-mail, o envio pela Gmail API está funcionando. 🧡\n\n— Meu Mercado',
    );
  }
}

export class SmtpEmailService implements EmailService {
  private readonly logger = new Logger('Email');
  constructor(
    private readonly transporter: EmailTransporter,
    private readonly from: string,
  ) {}

  async enviar(para: string, assunto: string, corpo: string, html?: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: para,
        subject: assunto,
        text: corpo,
        ...(html ? { html } : {}),
      });
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
