import { Inject, Injectable } from '@nestjs/common';
import { Money, PriceObservation } from '@meumercado/domain';
import { SEED_DATA } from '../../data/data.module.js';
import type { SeedData } from '../../data/seed.js';

/**
 * Porta de acesso às observações de preço (implementação trocável: memória →
 * Postgres). Assíncrona porque a implementação persistente (TypeORM) é async.
 */
export interface PriceObservationRepository {
  add(obs: PriceObservation): Promise<void>;
  findByProduto(produtoId: string): Promise<PriceObservation[]>;
  all(): Promise<PriceObservation[]>;
  /** Move as observações de um produto para outro (ao juntar duplicados). */
  reassignProduto(fromId: string, toId: string): Promise<void>;
  /** Move as observações de um mercado para outro, adotando nome/endereço do destino. */
  reassignMercado(
    fromId: string,
    toId: string,
    nome: string,
    endereco: string | null,
  ): Promise<void>;
  /** Apaga todas as observações de um produto (ao excluir o produto). */
  deleteByProduto(produtoId: string): Promise<void>;
  /** Apaga todas as observações de um mercado (ao excluir o mercado). */
  deleteByMercado(mercadoId: string): Promise<void>;
  /** Corrige o valor de UMA observação (ex.: preço da caixa em vez da unidade). */
  updatePreco(id: string, priceCents: number): Promise<void>;
  /** Apaga UMA observação pelo id (reporte errado). */
  deleteById(id: string): Promise<void>;
  /** Move UMA observação para outro produto (ao separar gramaturas que ficaram juntas). */
  moverObservacao(obsId: string, novoProdutoId: string): Promise<void>;
}

export const PRICE_OBSERVATION_REPOSITORY = 'PRICE_OBSERVATION_REPOSITORY';

/** Implementação em memória (dev local sem banco). Parte do seed de demonstração. */
@Injectable()
export class InMemoryPriceObservationRepository implements PriceObservationRepository {
  private readonly observations: PriceObservation[];

  constructor(@Inject(SEED_DATA) seed: SeedData) {
    this.observations = [...seed.observations];
  }

  add(obs: PriceObservation): Promise<void> {
    this.observations.push(obs);
    return Promise.resolve();
  }

  findByProduto(produtoId: string): Promise<PriceObservation[]> {
    return Promise.resolve(this.observations.filter((o) => o.produtoId === produtoId));
  }

  all(): Promise<PriceObservation[]> {
    return Promise.resolve(this.observations);
  }

  reassignMercado(
    fromId: string,
    toId: string,
    nome: string,
    endereco: string | null,
  ): Promise<void> {
    for (let i = 0; i < this.observations.length; i++) {
      const o = this.observations[i]!;
      if (o.mercadoId !== fromId) continue;
      this.observations[i] = new PriceObservation({
        id: o.id,
        produtoId: o.produtoId,
        mercadoId: toId,
        price: o.price,
        source: o.source,
        reporterId: o.reporterId,
        observedAt: o.observedAt,
        mercadoNome: nome,
        ...(endereco !== null ? { mercadoEndereco: endereco } : {}),
        ...(o.mercadoLat !== undefined ? { mercadoLat: o.mercadoLat } : {}),
        ...(o.mercadoLng !== undefined ? { mercadoLng: o.mercadoLng } : {}),
      });
    }
    return Promise.resolve();
  }

  deleteByProduto(produtoId: string): Promise<void> {
    for (let i = this.observations.length - 1; i >= 0; i--) {
      if (this.observations[i]!.produtoId === produtoId) this.observations.splice(i, 1);
    }
    return Promise.resolve();
  }

  deleteByMercado(mercadoId: string): Promise<void> {
    for (let i = this.observations.length - 1; i >= 0; i--) {
      if (this.observations[i]!.mercadoId === mercadoId) this.observations.splice(i, 1);
    }
    return Promise.resolve();
  }

  updatePreco(id: string, priceCents: number): Promise<void> {
    for (let i = 0; i < this.observations.length; i++) {
      const o = this.observations[i]!;
      if (o.id !== id) continue;
      this.observations[i] = new PriceObservation({
        id: o.id,
        produtoId: o.produtoId,
        mercadoId: o.mercadoId,
        price: Money.fromCents(priceCents),
        source: o.source,
        reporterId: o.reporterId,
        observedAt: o.observedAt,
        ...(o.mercadoNome !== undefined ? { mercadoNome: o.mercadoNome } : {}),
        ...(o.mercadoEndereco !== undefined ? { mercadoEndereco: o.mercadoEndereco } : {}),
        ...(o.mercadoLat !== undefined ? { mercadoLat: o.mercadoLat } : {}),
        ...(o.mercadoLng !== undefined ? { mercadoLng: o.mercadoLng } : {}),
      });
    }
    return Promise.resolve();
  }

  deleteById(id: string): Promise<void> {
    const i = this.observations.findIndex((o) => o.id === id);
    if (i >= 0) this.observations.splice(i, 1);
    return Promise.resolve();
  }

  moverObservacao(obsId: string, novoProdutoId: string): Promise<void> {
    for (let i = 0; i < this.observations.length; i++) {
      const o = this.observations[i]!;
      if (o.id !== obsId) continue;
      this.observations[i] = new PriceObservation({
        id: o.id,
        produtoId: novoProdutoId,
        mercadoId: o.mercadoId,
        price: o.price,
        source: o.source,
        reporterId: o.reporterId,
        observedAt: o.observedAt,
        ...(o.mercadoNome !== undefined ? { mercadoNome: o.mercadoNome } : {}),
        ...(o.mercadoEndereco !== undefined ? { mercadoEndereco: o.mercadoEndereco } : {}),
        ...(o.mercadoLat !== undefined ? { mercadoLat: o.mercadoLat } : {}),
        ...(o.mercadoLng !== undefined ? { mercadoLng: o.mercadoLng } : {}),
      });
    }
    return Promise.resolve();
  }

  reassignProduto(fromId: string, toId: string): Promise<void> {
    for (let i = 0; i < this.observations.length; i++) {
      const o = this.observations[i]!;
      if (o.produtoId !== fromId) continue;
      this.observations[i] = new PriceObservation({
        id: o.id,
        produtoId: toId,
        mercadoId: o.mercadoId,
        price: o.price,
        source: o.source,
        reporterId: o.reporterId,
        observedAt: o.observedAt,
        ...(o.mercadoNome !== undefined ? { mercadoNome: o.mercadoNome } : {}),
        ...(o.mercadoEndereco !== undefined ? { mercadoEndereco: o.mercadoEndereco } : {}),
        ...(o.mercadoLat !== undefined ? { mercadoLat: o.mercadoLat } : {}),
        ...(o.mercadoLng !== undefined ? { mercadoLng: o.mercadoLng } : {}),
      });
    }
    return Promise.resolve();
  }
}
