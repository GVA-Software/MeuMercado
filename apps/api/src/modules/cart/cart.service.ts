import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cart, CartItem, Money } from '@meumercado/domain';
import type { AddCartItemInput, CartDTO, CartMercadoDTO } from '@meumercado/contracts';
import { PricingService } from '../pricing/pricing.service.js';
import { CART_STORE, type CartStore } from './cart.store.js';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @Inject(CART_STORE) private readonly store: CartStore,
    private readonly pricing: PricingService,
  ) {}

  async criar(): Promise<CartDTO> {
    const cart = new Cart({ id: randomUUID() });
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async obter(id: string): Promise<CartDTO> {
    return this.toDTO(await this.requireCart(id));
  }

  async adicionarItem(id: string, input: AddCartItemInput, reporterId?: string): Promise<CartDTO> {
    const cart = await this.requireCart(id);
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

  async definirMercado(id: string, mercado: CartMercadoDTO | null): Promise<CartDTO> {
    const cart = await this.requireCart(id);
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

  async alterarQuantidade(id: string, lineId: string, quantity: number): Promise<CartDTO> {
    const cart = await this.requireCart(id);
    cart.setQuantity(lineId, quantity);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async removerItem(id: string, lineId: string): Promise<CartDTO> {
    const cart = await this.requireCart(id);
    cart.removeItem(lineId);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  async definirLimite(id: string, limiteCents: number | null): Promise<CartDTO> {
    const cart = await this.requireCart(id);
    cart.setLimite(limiteCents === null ? null : Money.fromCents(limiteCents));
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  private async requireCart(id: string): Promise<Cart> {
    const cart = await this.store.get(id);
    if (!cart) {
      throw new NotFoundException(`Carrinho não encontrado: ${id}`);
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
