import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cart, CartItem, Money } from '@meumercado/domain';
import type { AddCartItemInput, CartDTO, CartMercadoDTO, CompraDTO } from '@meumercado/contracts';
import { PricingService } from '../pricing/pricing.service.js';
import { ComprasService } from '../compras/compras.service.js';
import { CART_STORE, type CartStore } from './cart.store.js';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @Inject(CART_STORE) private readonly store: CartStore,
    private readonly pricing: PricingService,
    private readonly compras: ComprasService,
  ) {}

  async criar(userId: string): Promise<CartDTO> {
    const cart = new Cart({ id: randomUUID(), userId });
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async obter(id: string, userId: string): Promise<CartDTO> {
    return this.toDTO(await this.requireCart(id, userId));
  }

  async adicionarItem(id: string, input: AddCartItemInput, reporterId: string): Promise<CartDTO> {
    const cart = await this.requireCart(id, reporterId);
    cart.addItem(
      new CartItem({
        lineId: randomUUID(),
        produtoId: input.produtoId,
        nome: input.nome,
        unitPrice: Money.fromCents(input.unitPriceCents),
        quantity: input.quantity,
        ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      }),
    );
    await this.store.save(cart);
    // Auto-report: se a compra está vinculada a um mercado, o preço digitado
    // alimenta a base colaborativa automaticamente (best-effort).
    const m = cart.mercado;
    if (m && reporterId) {
      try {
        await this.pricing.reportar(
          {
            produtoId: input.produtoId,
            mercadoId: m.id,
            mercadoNome: m.nome,
            ...(m.endereco ? { mercadoEndereco: m.endereco } : {}),
            ...(m.lat !== undefined ? { mercadoLat: m.lat } : {}),
            ...(m.lng !== undefined ? { mercadoLng: m.lng } : {}),
            priceCents: input.unitPriceCents,
            source: 'manual',
          },
          reporterId,
        );
      } catch (e) {
        this.logger.warn(`Auto-report do carrinho falhou: ${String(e)}`);
      }
    }
    return this.toDTO(cart);
  }

  async definirMercado(
    id: string,
    userId: string,
    mercado: CartMercadoDTO | null,
  ): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    cart.setMercado(
      mercado
        ? {
            id: mercado.id,
            nome: mercado.nome,
            ...(mercado.endereco !== undefined ? { endereco: mercado.endereco } : {}),
            ...(mercado.lat !== undefined ? { lat: mercado.lat } : {}),
            ...(mercado.lng !== undefined ? { lng: mercado.lng } : {}),
          }
        : null,
    );
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async alterarQuantidade(
    id: string,
    userId: string,
    lineId: string,
    quantity: number,
  ): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    cart.setQuantity(lineId, quantity);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async removerItem(id: string, userId: string, lineId: string): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    cart.removeItem(lineId);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async definirLimite(id: string, userId: string, limiteCents: number | null): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    cart.setLimite(limiteCents === null ? null : Money.fromCents(limiteCents));
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  /** Fecha a compra: salva no histórico e esvazia o carrinho para a próxima. */
  async finalizar(id: string, userId: string): Promise<CompraDTO> {
    const cart = await this.requireCart(id, userId);
    if (cart.items.length === 0) {
      throw new BadRequestException('Carrinho vazio — adicione itens antes de finalizar.');
    }
    const compra = await this.compras.criarDeCarrinho(cart, userId);
    for (const item of cart.items) cart.removeItem(item.lineId);
    cart.setMercado(null);
    await this.store.save(cart);
    return compra;
  }

  /**
   * Carrega o carrinho garantindo que pertence ao usuário. Carrinho de OUTRO dono
   * responde 404 (o app cria um novo no fallback) — evita, num aparelho
   * compartilhado, o usuário B abrir o carrinho do A pelo id no localStorage.
   * Carrinhos legados (sem dono) são adotados pelo primeiro usuário que os toca.
   */
  private async requireCart(id: string, userId: string): Promise<Cart> {
    const cart = await this.store.get(id);
    if (!cart) {
      throw new NotFoundException(`Carrinho não encontrado: ${id}`);
    }
    if (cart.userId !== undefined && cart.userId !== userId) {
      throw new NotFoundException(`Carrinho não encontrado: ${id}`);
    }
    if (cart.userId === undefined) {
      // Adota o carrinho legado para este usuário (persiste o dono).
      const adotado = new Cart({
        id: cart.id,
        userId,
        limite: cart.limite,
        items: cart.items,
        mercado: cart.mercado,
      });
      await this.store.save(adotado);
      return adotado;
    }
    return cart;
  }

  private toDTO(cart: Cart): CartDTO {
    const m = cart.mercado;
    return {
      id: cart.id,
      items: cart.items.map((i) => i.toJSON()),
      total: cart.total().toJSON(),
      limite: cart.limite?.toJSON() ?? null,
      remaining: cart.remaining()?.toJSON() ?? null,
      progressPercent: cart.progressPercent(),
      status: cart.status(),
      mercado: m
        ? {
            id: m.id,
            nome: m.nome,
            ...(m.endereco ? { endereco: m.endereco } : {}),
            ...(m.lat !== undefined ? { lat: m.lat } : {}),
            ...(m.lng !== undefined ? { lng: m.lng } : {}),
          }
        : null,
    };
  }
}
