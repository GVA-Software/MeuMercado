import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import {
  ACCESS_LOG_REPOSITORY,
  type AccessLogRepository,
} from './access-log.repository.js';

/** Requisição Express só com o que precisamos (o guard de JWT injeta `user`). */
interface ReqLike {
  method: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id?: string };
}

/**
 * Registra os ACESSOS DE ESCRITA (POST/PUT/PATCH/DELETE) num log append-only —
 * art. 15 do Marco Civil. Roda DEPOIS dos guards, então `req.user` já está
 * preenchido nas rotas autenticadas. É best-effort: falha ao gravar NUNCA
 * derruba a request (o log é acessório à resposta do usuário).
 *
 * Telemetria pura (analytics) é ignorada — o log é para conteúdo, não beacon.
 */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly MUTACOES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  private readonly IGNORAR = ['/api/analytics'];

  constructor(@Inject(ACCESS_LOG_REPOSITORY) private readonly logs: AccessLogRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<ReqLike>();
      const path = this.pathDe(req);
      if (this.MUTACOES.has(req.method) && !this.IGNORAR.some((p) => path.startsWith(p))) {
        this.registrar(req, path);
      }
    }
    return next.handle();
  }

  /** Grava em background — não bloqueia nem propaga erro para a request. */
  private registrar(req: ReqLike, path: string): void {
    void this.logs
      .registrar({
        id: randomUUID(),
        method: req.method,
        path,
        userId: req.user?.id ?? null,
        ip: this.ipDe(req),
        userAgent: this.recorta(this.headerUnico(req.headers['user-agent']), 512),
        criadoEm: new Date(),
      })
      .catch(() => {
        /* log é acessório: nunca quebra a resposta ao usuário */
      });
  }

  private pathDe(req: ReqLike): string {
    const bruto = req.originalUrl ?? req.url ?? '';
    return this.recorta(bruto.split('?')[0], 512) ?? '';
  }

  private ipDe(req: ReqLike): string | null {
    const xff = this.headerUnico(req.headers['x-forwarded-for']);
    if (xff) return this.recorta(xff.split(',')[0]?.trim(), 64);
    return this.recorta(req.ip, 64);
  }

  private headerUnico(v: string | string[] | undefined): string | undefined {
    return Array.isArray(v) ? v[0] : v;
  }

  private recorta(v: string | undefined, max: number): string | null {
    const s = (v ?? '').trim();
    return s ? s.slice(0, max) : null;
  }
}
