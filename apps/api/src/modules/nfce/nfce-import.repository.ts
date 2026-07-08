import { Injectable } from '@nestjs/common';

/** Registro das notas já importadas (por chave de acesso) — trava anti-duplicata. */
export interface NfceImportRepository {
  jaImportada(chave: string): Promise<boolean>;
  registrar(chave: string, reporterId: string): Promise<void>;
}

export const NFCE_IMPORT_REPOSITORY = 'NFCE_IMPORT_REPOSITORY';

@Injectable()
export class InMemoryNfceImportRepository implements NfceImportRepository {
  private readonly chaves = new Set<string>();

  jaImportada(chave: string): Promise<boolean> {
    return Promise.resolve(this.chaves.has(chave));
  }

  registrar(chave: string): Promise<void> {
    this.chaves.add(chave);
    return Promise.resolve();
  }
}
