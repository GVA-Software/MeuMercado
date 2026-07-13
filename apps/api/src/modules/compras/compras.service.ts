import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Cart } from '@meumercado/domain';
import type { CompraDTO, CompraItemDTO } from '@meumercado/contracts';
import { PricingService } from '../pricing/pricing.service.js';
import { COMPRA_REPOSITORY, type CompraRepository } from './compra.repository.js';

export interface RegistrarCompra {
  mercadoId?: string | null;
  mercadoNome?: string | null;
  mercadoEndereco?: string | null;
  data?: Date;
  itens: CompraItemDTO[];
}

@Injectable()
export class ComprasService {
  constructor(
    @Inject(COMPRA_REPOSITORY) private readonly repo: CompraRepository,
    private readonly pricing: PricingService,
  ) {}

  /** Registra uma compra fechada (do carrinho ou da nota fiscal). */
  async registrar(userId: string, params: RegistrarCompra): Promise<CompraDTO> {
    // Economia: soma de (média da base − preço pago) × qtd, quando pagou abaixo.
    let economiaCents = 0;
    for (const i of params.itens) {
      const resumo = await this.pricing.resumo(i.produtoId);
      if (resumo.mediaCents !== null && i.unitPriceCents < resumo.mediaCents) {
        economiaCents += Math.round((resumo.mediaCents - i.unitPriceCents) * i.quantity);
      }
    }
    const totalCents = params.itens.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);

    const compra: CompraDTO = {
      id: randomUUID(),
      mercadoId: params.mercadoId ?? null,
      mercadoNome: params.mercadoNome ?? null,
      mercadoEndereco: params.mercadoEndereco ?? null,
      totalCents,
      economiaCents,
      itens: params.itens,
      criadaEm: (params.data ?? new Date()).toISOString(),
    };
    await this.repo.salvar(userId, compra);
    return compra;
  }

  /** Fecha uma compra a partir do carrinho. */
  criarDeCarrinho(cart: Cart, userId: string): Promise<CompraDTO> {
    const m = cart.mercado;
    return this.registrar(userId, {
      mercadoId: m?.id ?? null,
      mercadoNome: m?.nome ?? null,
      mercadoEndereco: m?.endereco ?? null,
      itens: cart.items.map((i) => ({
        produtoId: i.produtoId,
        nome: i.nome,
        ...(i.emoji !== undefined ? { emoji: i.emoji } : {}),
        unitPriceCents: i.unitPrice.cents,
        quantity: i.quantity,
      })),
    });
  }

  listar(userId: string): Promise<CompraDTO[]> {
    return this.repo.listarPorUsuario(userId);
  }

  excluir(userId: string, compraId: string): Promise<void> {
    return this.repo.excluir(userId, compraId);
  }

  excluirTodas(userId: string): Promise<void> {
    return this.repo.excluirTodas(userId);
  }
}
