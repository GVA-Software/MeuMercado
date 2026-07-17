import { Injectable } from '@nestjs/common';

/** Um sinônimo dinâmico ensinado pelo ADM: quando o usuário diz `alias`, busca `canonico`. */
export interface SinonimoStored {
  alias: string; // normalizado (sem acento, minúsculo)
  canonico: string;
  criadoEm: Date;
}

export interface SinonimoRepository {
  listar(): Promise<SinonimoStored[]>;
  /** Cria ou atualiza (chave: alias). */
  salvar(s: SinonimoStored): Promise<void>;
  remover(alias: string): Promise<void>;
}

export const SINONIMO_REPOSITORY = 'SINONIMO_REPOSITORY';

@Injectable()
export class InMemorySinonimoRepository implements SinonimoRepository {
  private readonly porAlias = new Map<string, SinonimoStored>();

  listar(): Promise<SinonimoStored[]> {
    return Promise.resolve(
      [...this.porAlias.values()].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime()),
    );
  }
  salvar(s: SinonimoStored): Promise<void> {
    this.porAlias.set(s.alias, s);
    return Promise.resolve();
  }
  remover(alias: string): Promise<void> {
    this.porAlias.delete(alias);
    return Promise.resolve();
  }
}
