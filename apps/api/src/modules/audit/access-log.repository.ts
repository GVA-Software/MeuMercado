import { Injectable } from '@nestjs/common';

/**
 * Registro de acesso (write) para cumprir o art. 15 do Marco Civil da Internet:
 * permitir identificar, sob ordem judicial, quem inseriu um conteúdo (ex.: um
 * preço falso/difamatório). APPEND-ONLY — só inserimos, nunca editamos/apagamos.
 * Retido por no mínimo 6 meses. Guarda o vínculo autor↔conteúdo mesmo após a
 * exclusão da conta (a LGPD ressalva a guarda para cumprimento legal).
 */
export interface AccessLogEntry {
  id: string;
  /** Método HTTP (só registramos mutações: POST/PUT/PATCH/DELETE). */
  method: string;
  /** Caminho da rota, sem querystring. */
  path: string;
  /** Autor autenticado (null se rota pública, ex.: login/cadastro). */
  userId: string | null;
  /** IP de origem (1º hop do X-Forwarded-For, atrás do proxy do Render). */
  ip: string | null;
  userAgent: string | null;
  /** Timestamp do SERVIDOR (não confiar em relógio de cliente). */
  criadoEm: Date;
}

export interface AccessLogRepository {
  registrar(entry: AccessLogEntry): Promise<void>;
  /** Últimos acessos de um usuário (para atender pedido legal/administrativo). */
  listarPorUsuario(userId: string, limite?: number): Promise<AccessLogEntry[]>;
}

export const ACCESS_LOG_REPOSITORY = 'ACCESS_LOG_REPOSITORY';

/** Implementação em memória (dev local sem banco). */
@Injectable()
export class InMemoryAccessLogRepository implements AccessLogRepository {
  private readonly logs: AccessLogEntry[] = [];

  registrar(entry: AccessLogEntry): Promise<void> {
    this.logs.push(entry);
    return Promise.resolve();
  }

  listarPorUsuario(userId: string, limite = 500): Promise<AccessLogEntry[]> {
    return Promise.resolve(
      this.logs
        .filter((l) => l.userId === userId)
        .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
        .slice(0, limite),
    );
  }
}
