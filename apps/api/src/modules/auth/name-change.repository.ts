import { Injectable } from '@nestjs/common';

/** Um registro de alteração de nome (trilha de auditoria, mantida no banco). */
export interface NameChange {
  id: string;
  userId: string;
  nomeAnterior: string;
  nomeNovo: string;
  alteradoEm: Date;
}

/** Porta de auditoria de mudanças de nome. */
export interface NameChangeRepository {
  registrar(rec: NameChange): Promise<void>;
  listar(userId: string): Promise<NameChange[]>;
}

export const NAME_CHANGE_REPOSITORY = 'NAME_CHANGE_REPOSITORY';

@Injectable()
export class InMemoryNameChangeRepository implements NameChangeRepository {
  private readonly registros: NameChange[] = [];

  registrar(rec: NameChange): Promise<void> {
    this.registros.push(rec);
    return Promise.resolve();
  }
  listar(userId: string): Promise<NameChange[]> {
    return Promise.resolve(
      this.registros
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.alteradoEm.getTime() - a.alteradoEm.getTime()),
    );
  }
}
