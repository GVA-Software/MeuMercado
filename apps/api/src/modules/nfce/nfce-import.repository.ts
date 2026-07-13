import { Injectable } from '@nestjs/common';

/** Registro das notas já importadas (por chave de acesso) — trava anti-duplicata. */
export interface NfceImportRepository {
  /** Advisory (para a prévia): a nota já foi importada? Não use como trava. */
  jaImportada(chave: string): Promise<boolean>;
  /**
   * Registra a nota de forma ATÔMICA. Retorna `true` se ESTA chamada inseriu (é
   * nova) e `false` se já existia — usado como trava contra duplo-toque/corrida.
   */
  registrar(chave: string, reporterId: string): Promise<boolean>;
  /** Remove o registro — usado para rollback se a importação falhar no meio. */
  remover(chave: string): Promise<void>;
}

export const NFCE_IMPORT_REPOSITORY = 'NFCE_IMPORT_REPOSITORY';

@Injectable()
export class InMemoryNfceImportRepository implements NfceImportRepository {
  private readonly chaves = new Set<string>();

  jaImportada(chave: string): Promise<boolean> {
    return Promise.resolve(this.chaves.has(chave));
  }

  registrar(chave: string): Promise<boolean> {
    if (this.chaves.has(chave)) return Promise.resolve(false);
    this.chaves.add(chave);
    return Promise.resolve(true);
  }

  remover(chave: string): Promise<void> {
    this.chaves.delete(chave);
    return Promise.resolve();
  }
}
