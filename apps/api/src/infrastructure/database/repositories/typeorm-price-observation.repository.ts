import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Money, PriceObservation, type PriceSource } from '@meumercado/domain';
import type { PriceObservationRepository } from '../../../modules/pricing/price-observation.repository.js';
import { PriceObservationEntity } from '../entities/price-observation.entity.js';

/** Persistência das observações de preço no Postgres (dados duráveis). */
@Injectable()
export class TypeOrmPriceObservationRepository implements PriceObservationRepository {
  // Cache do scan completo (`all`): a tabela de preços, o mutirão e a Nina leem TODAS
  // as observações a cada request. A base muda devagar; cacheamos e invalidamos em
  // toda escrita. O TTL é rede de segurança se rodarmos em +de 1 instância (uma
  // escrita numa não invalida a cache da outra) — some sozinho em poucos segundos.
  private static readonly TTL_MS = 15_000;
  private cache: PriceObservation[] | null = null;
  private cacheAt = 0;

  constructor(
    @InjectRepository(PriceObservationEntity)
    private readonly repo: Repository<PriceObservationEntity>,
  ) {}

  private invalidar(): void {
    this.cache = null;
  }

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
    this.invalidar();
  }

  async findByProduto(produtoId: string): Promise<PriceObservation[]> {
    const rows = await this.repo.find({ where: { produtoId } });
    return rows.map((r) => this.toDomain(r));
  }

  async all(): Promise<PriceObservation[]> {
    if (this.cache && Date.now() - this.cacheAt < TypeOrmPriceObservationRepository.TTL_MS) {
      return this.cache;
    }
    const rows = await this.repo.find();
    // Só leituras a jusante (filter/group) — seguro compartilhar a referência.
    this.cache = rows.map((r) => this.toDomain(r));
    this.cacheAt = Date.now();
    return this.cache;
  }

  async reassignProduto(fromId: string, toId: string): Promise<void> {
    await this.repo.update({ produtoId: fromId }, { produtoId: toId });
    this.invalidar();
  }

  async reassignMercado(
    fromId: string,
    toId: string,
    nome: string,
    endereco: string | null,
  ): Promise<void> {
    await this.repo.update(
      { mercadoId: fromId },
      { mercadoId: toId, mercadoNome: nome, mercadoEndereco: endereco },
    );
    this.invalidar();
  }

  async deleteByProduto(produtoId: string): Promise<void> {
    await this.repo.delete({ produtoId });
    this.invalidar();
  }
}
