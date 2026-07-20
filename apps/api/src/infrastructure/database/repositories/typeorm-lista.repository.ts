import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SavedListDTO } from '@meumercado/contracts';
import type { ListaRepository } from '../../../modules/listas/lista.repository.js';
import { ListaEntity } from '../entities/lista.entity.js';

@Injectable()
export class TypeOrmListaRepository implements ListaRepository {
  constructor(
    @InjectRepository(ListaEntity)
    private readonly repo: Repository<ListaEntity>,
  ) {}

  async salvar(userId: string, lista: SavedListDTO): Promise<void> {
    await this.repo.insert({
      id: lista.id,
      userId,
      nome: lista.nome,
      itens: lista.itens,
      criadaEm: new Date(lista.criadaEm),
    });
  }

  async listarPorUsuario(userId: string): Promise<SavedListDTO[]> {
    const rows = await this.repo.find({ where: { userId }, order: { criadaEm: 'DESC' } });
    return rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      itens: r.itens,
      criadaEm: r.criadaEm.toISOString(),
    }));
  }

  contarPorUsuario(userId: string): Promise<number> {
    return this.repo.count({ where: { userId } });
  }

  async excluir(userId: string, listaId: string): Promise<void> {
    // userId no filtro garante que só apaga a lista do próprio usuário.
    await this.repo.delete({ id: listaId, userId });
  }

  async excluirTodas(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
