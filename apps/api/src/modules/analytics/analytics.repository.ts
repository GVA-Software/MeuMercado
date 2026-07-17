import { Injectable } from '@nestjs/common';

/** Um evento de analytics já carimbado (usuário + timestamp). */
export interface AnalyticsEvent {
  id: string;
  name: string;
  userId: string | null;
  props: Record<string, string | number | boolean> | null;
  createdAt: Date;
}

/** Contagem por evento: usuários distintos + total disparado. */
export interface EventoResumo {
  name: string;
  usuarios: number;
  total: number;
}

/** Porta de analytics (append-only + agregações para o funil). */
export interface AnalyticsRepository {
  registrar(ev: AnalyticsEvent): Promise<void>;
  resumo(): Promise<EventoResumo[]>;
  /** Ids de usuário distintos que dispararam um evento. */
  usuariosComEvento(name: string): Promise<string[]>;
  /** Todos os eventos de um nome (com props) — ex.: nina_sem_resposta pro treino. */
  listarPorNome(name: string): Promise<AnalyticsEvent[]>;
}

export const ANALYTICS_REPOSITORY = 'ANALYTICS_REPOSITORY';

/** Reduções puras (compartilhadas pelas implementações) — fáceis de testar. */
export function resumirEventos(eventos: readonly AnalyticsEvent[]): EventoResumo[] {
  const usuarios = new Map<string, Set<string>>();
  const totais = new Map<string, number>();
  for (const e of eventos) {
    totais.set(e.name, (totais.get(e.name) ?? 0) + 1);
    if (!usuarios.has(e.name)) usuarios.set(e.name, new Set());
    if (e.userId) usuarios.get(e.name)!.add(e.userId);
  }
  return [...totais].map(([name, total]) => ({
    name,
    total,
    usuarios: usuarios.get(name)?.size ?? 0,
  }));
}

export function usuariosDistintos(eventos: readonly AnalyticsEvent[], name: string): string[] {
  return [
    ...new Set(eventos.filter((e) => e.name === name && e.userId).map((e) => e.userId as string)),
  ];
}

@Injectable()
export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  private readonly eventos: AnalyticsEvent[] = [];

  registrar(ev: AnalyticsEvent): Promise<void> {
    this.eventos.push(ev);
    return Promise.resolve();
  }
  resumo(): Promise<EventoResumo[]> {
    return Promise.resolve(resumirEventos(this.eventos));
  }
  usuariosComEvento(name: string): Promise<string[]> {
    return Promise.resolve(usuariosDistintos(this.eventos, name));
  }
  listarPorNome(name: string): Promise<AnalyticsEvent[]> {
    return Promise.resolve(this.eventos.filter((e) => e.name === name));
  }
}
