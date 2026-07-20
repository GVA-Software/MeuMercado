import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  AddCartItemSchema,
  CartMercadoSchema,
  MarcarCompradoSchema,
  SetLimiteSchema,
  type AddCartItemInput,
  type CartDTO,
  type CartMercadoDTO,
  type CompraDTO,
  type MarcarCompradoInput,
  type SetLimiteInput,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { CartService } from './cart.service.js';

const SetQuantitySchema = z.object({ quantity: z.number().int().min(1).max(999) });

// TODO o carrinho exige autenticação e é escopado ao dono (ver CartService).
@Controller('carts')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly service: CartService) {}

  @Post()
  @HttpCode(201)
  criar(@CurrentUser() user: AuthedUser): Promise<CartDTO> {
    return this.service.criar(user.id);
  }

  @Get(':id')
  obter(@Param('id') id: string, @CurrentUser() user: AuthedUser): Promise<CartDTO> {
    return this.service.obter(id, user.id);
  }

  @Post(':id/items')
  @HttpCode(201)
  adicionarItem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddCartItemSchema)) body: AddCartItemInput,
    @CurrentUser() user: AuthedUser,
  ): Promise<CartDTO> {
    return this.service.adicionarItem(id, body, user.id);
  }

  /** Vincula a compra a um mercado (confirmado pela localização). */
  @Put(':id/mercado')
  definirMercado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CartMercadoSchema)) body: CartMercadoDTO,
    @CurrentUser() user: AuthedUser,
  ): Promise<CartDTO> {
    return this.service.definirMercado(id, user.id, body);
  }

  /** Desvincula o mercado da compra (volta ao estado "sem mercado"). */
  @Delete(':id/mercado')
  removerMercado(@Param('id') id: string, @CurrentUser() user: AuthedUser): Promise<CartDTO> {
    return this.service.definirMercado(id, user.id, null);
  }

  /** Semeia a lista com os itens da última compra (planejados). */
  @Post(':id/repetir-ultima')
  @HttpCode(201)
  repetirUltima(@Param('id') id: string, @CurrentUser() user: AuthedUser): Promise<CartDTO> {
    return this.service.repetirUltima(id, user.id);
  }

  /** Fecha a compra: guarda no histórico e esvazia o carrinho. */
  @Post(':id/finalizar')
  @HttpCode(201)
  finalizar(@Param('id') id: string, @CurrentUser() user: AuthedUser): Promise<CompraDTO> {
    return this.service.finalizar(id, user.id);
  }

  /** Risca um item da lista (comprei): grava preço + qtd e alimenta a base. */
  @Post(':id/items/:lineId/comprado')
  marcarComprado(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body(new ZodValidationPipe(MarcarCompradoSchema)) body: MarcarCompradoInput,
    @CurrentUser() user: AuthedUser,
  ): Promise<CartDTO> {
    return this.service.marcarComprado(id, user.id, lineId, body.precoCents, body.quantity);
  }

  /** Desmarca um item (volta a planejado). */
  @Delete(':id/items/:lineId/comprado')
  desmarcar(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthedUser,
  ): Promise<CartDTO> {
    return this.service.desmarcar(id, user.id, lineId);
  }

  @Patch(':id/items/:lineId')
  alterarQuantidade(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body(new ZodValidationPipe(SetQuantitySchema)) body: z.infer<typeof SetQuantitySchema>,
    @CurrentUser() user: AuthedUser,
  ): Promise<CartDTO> {
    return this.service.alterarQuantidade(id, user.id, lineId, body.quantity);
  }

  @Delete(':id/items/:lineId')
  removerItem(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthedUser,
  ): Promise<CartDTO> {
    return this.service.removerItem(id, user.id, lineId);
  }

  @Put(':id/limite')
  definirLimite(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetLimiteSchema)) body: SetLimiteInput,
    @CurrentUser() user: AuthedUser,
  ): Promise<CartDTO> {
    return this.service.definirLimite(id, user.id, body.limiteCents);
  }
}
