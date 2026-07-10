import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Money, PriceObservation, type PriceSource } from '@meumercado/domain';
import type { PriceObservationRepository } from '../../../modules/pricing/price-observation.repository.js';
import { PriceObservationEntity } from '../entities/price-observation.entity.js';

/** Persistência das observações de preço no Postgres (dados duráveis). */
@Injectable()
export class TypeOrmPriceObservationRepository implements PriceObservationRepository {
  constructor(
    @InjectRepository(PriceObservationEntity)
    private readonly repo: Repository<PriceObservationEntity>,
  ) {}

  private toDomain(row: PriceObservationEntity): PriceObservation {
    return new PriceObservation({
      id: row.id,
      produtoId: row.produtoId,
      mercadoId: row.mercadoId,
      price: Money.fromCents(row.priceCents),
      source: row.source as PriceSource,
      reporterId: row.reporterId,
      observedAt: row.observedAt,
      ...(row.mercadoNome !== null ? { mercadoNome: row.mercadoNome } : {}),
      ...(row.mercadoEndereco !== null ? { mercadoEndereco: row.mercadoEndereco } : {}),
      ...(row.mercadoLat !== null ? { mercadoLat: row.mercadoLat } : {}),
      ...(row.mercadoLng !== null ? { mercadoLng: row.mercadoLng } : {}),
    });
  }

  async add(obs: PriceObservation): Promise<void> {
    await this.repo.insert({
      id: obs.id,
      produtoId: obs.produtoId,
      mercadoId: obs.mercadoId,
      mercadoNome: obs.mercadoNome ?? null,
      mercadoEndereco: obs.mercadoEndereco ?? null,
      mercadoLat: obs.mercadoLat ?? null,
      mercadoLng: obs.mercadoLng ?? null,
      priceCents: obs.price.cents,
      source: obs.source,
      reporterId: obs.reporterId,
      observedAt: obs.observedAt,
    });
  }

  async findByProduto(produtoId: string): Promise<PriceObservation[]> {
    const rows = await this.repo.find({ where: { produtoId } });
    return rows.map((r) => this.toDomain(r));
  }

  async all(): Promise<PriceObservation[]> {
    const rows = await this.repo.find();
    return rows.map((r) => this.toDomain(r));
  }

  async reassignProduto(fromId: string, toId: string): Promise<void> {
    await this.repo.update({ produtoId: fromId }, { produtoId: toId });
  }
}
