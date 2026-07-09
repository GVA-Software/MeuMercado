import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CompraDTO } from '@meumercado/contracts';
import type { CompraRepository } from '../../../modules/compras/compra.repository.js';
import { CompraEntity } from '../entities/compra.entity.js';

@Injectable()
export class TypeOrmCompraRepository implements CompraRepository {
  constructor(
    @InjectRepository(CompraEntity)
    private readonly repo: Repository<CompraEntity>,
  ) {}

  async salvar(userId: string, compra: CompraDTO): Promise<void> {
    await this.repo.insert({
      id: compra.id,
      userId,
      mercadoId: compra.mercadoId,
      mercadoNome: compra.mercadoNome,
      mercadoEndereco: compra.mercadoEndereco,
      totalCents: compra.totalCents,
      economiaCents: compra.economiaCents,
      itens: compra.itens,
      criadaEm: new Date(compra.criadaEm),
    });
  }

  async listarPorUsuario(userId: string): Promise<CompraDTO[]> {
    const rows = await this.repo.find({ where: { userId }, order: { criadaEm: 'DESC' } });
    return rows.map((r) => ({
      id: r.id,
      mercadoId: r.mercadoId,
      mercadoNome: r.mercadoNome,
      mercadoEndereco: r.mercadoEndereco,
      totalCents: r.totalCents,
      economiaCents: r.economiaCents,
      itens: r.itens,
      criadaEm: r.criadaEm.toISOString(),
    }));
  }
}
