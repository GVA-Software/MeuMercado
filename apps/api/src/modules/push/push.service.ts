import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import type { Env } from '../../config/env.schema.js';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionRepository,
} from './push-subscription.repository.js';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Formato da inscrição vinda do navegador (PushSubscription.toJSON()). */
export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey: string;

  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY) private readonly repo: PushSubscriptionRepository,
    config: ConfigService<Env, true>,
  ) {
    this.publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true });
    webpush.setVapidDetails(
      config.get('VAPID_SUBJECT', { infer: true }),
      this.publicKey,
      config.get('VAPID_PRIVATE_KEY', { infer: true }),
    );
  }

  chavePublica(): string {
    return this.publicKey;
  }

  async inscrever(userId: string, sub: BrowserSubscription): Promise<void> {
    await this.repo.salvar({
      id: randomUUID(),
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      criadoEm: new Date(),
    });
  }

  async desinscrever(endpoint: string): Promise<void> {
    await this.repo.removerPorEndpoint(endpoint);
  }

  /** Envia uma notificação para todos os dispositivos do usuário (best-effort). */
  async enviarPara(userId: string, payload: PushPayload): Promise<void> {
    const subs = await this.repo.listarPorUsuario(userId);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // Inscrição expirada/removida no dispositivo: limpa do banco.
            await this.repo.removerPorEndpoint(s.endpoint);
          } else {
            this.logger.warn(`Falha ao enviar push: ${String((e as Error)?.message ?? e)}`);
          }
        }
      }),
    );
  }
}
