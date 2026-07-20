import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cart, CartItem, Money } from '@meumercado/domain';
import type { AddCartItemInput, CartDTO, CartMercadoDTO, CompraDTO } from '@meumercado/contracts';
import { PricingService } from '../pricing/pricing.service.js';
import { ComprasService } from '../compras/compras.service.js';
import { ListasService } from '../listas/listas.service.js';
import { CART_STORE, type CartStore } from './cart.store.js';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @Inject(CART_STORE) private readonly store: CartStore,
    private readonly pricing: PricingService,
    private readonly compras: ComprasService,
    private readonly listas: ListasService,
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
    const temPreco = input.unitPriceCents !== undefined;
    cart.addItem(
      new CartItem({
        lineId: randomUUID(),
        produtoId: input.produtoId,
        nome: input.nome,
        quantity: input.quantity,
        // Sem preço = item PLANEJADO da lista; com preço = "add rápido" já comprado.
        ...(temPreco
          ? { unitPrice: Money.fromCents(input.unitPriceCents!), comprado: true }
          : {}),
        ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      }),
    );
    await this.store.save(cart);
    // Add rápido COM preço e mercado definido → já alimenta a base (best-effort).
    if (temPreco && cart.mercado) {
      await this.autoReport(cart, input.produtoId, input.unitPriceCents!, reporterId);
    }
    return this.toDTO(cart);
  }

  /** Risca um item da lista: grava preço + qtd e alimenta a base (se houver mercado). */
  async marcarComprado(
    id: string,
    userId: string,
    lineId: string,
    precoCents: number,
    quantity: number,
  ): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    cart.marcarComprado(lineId, Money.fromCents(precoCents), quantity);
    await this.store.save(cart);
    const item = cart.items.find((i) => i.lineId === lineId);
    if (item && cart.mercado) {
      await this.autoReport(cart, item.produtoId, precoCents, userId);
    }
    return this.toDTO(cart);
  }

  /** Semeia a lista com os itens da última compra do usuário (como PLANEJADOS). */
  async repetirUltima(id: string, userId: string): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    const ultima = await this.compras.ultimaDe(userId);
    if (!ultima || ultima.itens.length === 0) {
      throw new BadRequestException('Você ainda não tem uma compra anterior pra repetir.');
    }
    this.semear(cart, ultima.itens);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  /** Semeia a lista a partir de uma lista SALVA do usuário (como PLANEJADOS). */
  async usarLista(id: string, userId: string, listaId: string): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    const lista = await this.listas.obter(userId, listaId);
    if (!lista) throw new NotFoundException('Lista não encontrada.');
    this.semear(cart, lista.itens);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  /**
   * Adiciona itens ao carrinho como PLANEJADOS (sem preço), sem duplicar o que já
   * está lá (por produtoId). Base do "repetir última" e do "usar lista salva".
   */
  private semear(
    cart: Cart,
    itens: readonly {
      produtoId: string;
      nome: string;
      emoji?: string | undefined;
      quantity: number;
    }[],
  ): void {
    const existentes = new Set(cart.items.map((i) => i.produtoId));
    for (const it of itens) {
      if (existentes.has(it.produtoId)) continue;
      cart.addItem(
        new CartItem({
          lineId: randomUUID(),
          produtoId: it.produtoId,
          nome: it.nome,
          // Lista é por unidade inteira; compra por peso vira ao menos 1.
          quantity: Math.min(999, Math.max(1, Math.round(it.quantity))),
          ...(it.emoji !== undefined ? { emoji: it.emoji } : {}),
        }),
      );
      existentes.add(it.produtoId);
    }
  }

  /** Desmarca um item (volta a planejado; o preço já reportado permanece na base). */
  async desmarcar(id: string, userId: string, lineId: string): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    cart.desmarcar(lineId);
    await this.store.save(cart);
    return this.toDTO(cart);
  }

  /** Reporta o preço à base comunitária, atribuído ao mercado do carrinho. */
  private async autoReport(
    cart: Cart,
    produtoId: string,
    priceCents: number,
    reporterId: string,
  ): Promise<void> {
    const m = cart.mercado;
    if (!m || !reporterId) return;
    try {
      await this.pricing.reportar(
        {
          produtoId,
          mercadoId: m.id,
          mercadoNome: m.nome,
          ...(m.endereco ? { mercadoEndereco: m.endereco } : {}),
          ...(m.lat !== undefined ? { mercadoLat: m.lat } : {}),
          ...(m.lng !== undefined ? { mercadoLng: m.lng } : {}),
          priceCents,
          source: 'manual',
        },
        reporterId,
      );
    } catch (e) {
      this.logger.warn(`Auto-report do carrinho falhou: ${String(e)}`);
    }
  }

  async definirMercado(
    id: string,
    userId: string,
    mercado: CartMercadoDTO | null,
  ): Promise<CartDTO> {
    const cart = await this.requireCart(id, userId);
    // Integridade: itens já riscados tiveram o preço reportado ATRIBUÍDO a este
    // mercado. Não deixa remover nem trocar depois disso (só reconfirmar o mesmo).
    if (cart.comprados.length > 0 && (mercado?.id ?? null) !== (cart.mercado?.id ?? null)) {
      throw new BadRequestException(
        'Você já riscou itens neste mercado. Desmarque-os ou finalize a compra antes de trocar ou remover o mercado.',
      );
    }
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

  /** Fecha a compra: salva no histórico (só os itens comprados) e esvazia a lista. */
  async finalizar(id: string, userId: string): Promise<CompraDTO> {
    const cart = await this.requireCart(id, userId);
    if (cart.comprados.length === 0) {
      throw new BadRequestException('Nada comprado ainda — risque os itens que você pegou.');
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
