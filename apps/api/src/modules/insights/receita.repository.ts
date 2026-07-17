import { Injectable } from '@nestjs/common';

/** Receita/evento dinâmica ensinada pelo ADM: gatilhos (palavras) → itens da lista. */
export interface ReceitaStored {
  nome: string;
  gatilhos: string[];
  itens: string[];
  criadoEm: Date;
}

export interface ReceitaRepository {
  listar(): Promise<ReceitaStored[]>;
  /** Cria ou atualiza (chave: nome). */
  salvar(r: ReceitaStored): Promise<void>;
  remover(nome: string): Promise<void>;
}

export const RECEITA_REPOSITORY = 'RECEITA_REPOSITORY';

@Injectable()
export class InMemoryReceitaRepository implements ReceitaRepository {
  private readonly porNome = new Map<string, ReceitaStored>();

  listar(): Promise<ReceitaStored[]> {
    return Promise.resolve(
      [...this.porNome.values()].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime()),
    );
  }
  salvar(r: ReceitaStored): Promise<void> {
    this.porNome.set(r.nome, r);
    return Promise.resolve();
  }
  remover(nome: string): Promise<void> {
    this.porNome.delete(nome);
    return Promise.resolve();
  }
}
