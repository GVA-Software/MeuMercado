import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Cart } from '@meumercado/domain';
import type { CompraDTO, CompraItemDTO } from '@meumercado/contracts';
import { PricingService } from '../pricing/pricing.service.js';
import { COMPRA_REPOSITORY, type CompraRepository } from './compra.repository.js';

@Injectable()
export class ComprasService {
  constructor(
    @Inject(COMPRA_REPOSITORY) private readonly repo: CompraRepository,
    private readonly pricing: PricingService,
  ) {}

  /** Fecha uma compra a partir do carrinho (snapshot + economia estimada). */
  async criarDeCarrinho(cart: Cart, userId: string): Promise<CompraDTO> {
    const itens: CompraItemDTO[] = cart.items.map((i) => ({
      produtoId: i.produtoId,
      nome: i.nome,
      ...(i.emoji !== undefined ? { emoji: i.emoji } : {}),
      unitPriceCents: i.unitPrice.cents,
      quantity: i.quantity,
    }));

    // Economia: soma de (média da base − preço pago) × qtd, quando pagou abaixo.
    let economiaCents = 0;
    for (const i of cart.items) {
      const resumo = await this.pricing.resumo(i.produtoId);
      if (resumo.mediaCents !== null && i.unitPrice.cents < resumo.mediaCents) {
        economiaCents += (resumo.mediaCents - i.unitPrice.cents) * i.quantity;
      }
    }

    const m = cart.mercado;
    const compra: CompraDTO = {
      id: randomUUID(),
      mercadoId: m?.id ?? null,
      mercadoNome: m?.nome ?? null,
      mercadoEndereco: m?.endereco ?? null,
      totalCents: cart.total().cents,
      economiaCents,
      itens,
      criadaEm: new Date().toISOString(),
    };
    await this.repo.salvar(userId, compra);
    return compra;
  }

  listar(userId: string): Promise<CompraDTO[]> {
    return this.repo.listarPorUsuario(userId);
  }
}
