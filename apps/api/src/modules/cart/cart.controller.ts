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
  SetLimiteSchema,
  type AddCartItemInput,
  type CartDTO,
  type CartMercadoDTO,
  type CompraDTO,
  type SetLimiteInput,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard.js';
import { CartService } from './cart.service.js';

const SetQuantitySchema = z.object({ quantity: z.number().int().min(1).max(999) });

@Controller('carts')
export class CartController {
  constructor(private readonly service: CartService) {}

  @Post()
  @HttpCode(201)
  criar(): Promise<CartDTO> {
    return this.service.criar();
  }

  @Get(':id')
  obter(@Param('id') id: string): Promise<CartDTO> {
    return this.service.obter(id);
  }

  @Post(':id/items')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  adicionarItem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddCartItemSchema)) body: AddCartItemInput,
    @CurrentUser() user: AuthedUser,
  ): Promise<CartDTO> {
    return this.service.adicionarItem(id, body, user.id);
  }

  /** Vincula a compra a um mercado (confirmado pela localização). */
  @Put(':id/mercado')
  @UseGuards(JwtAuthGuard)
  definirMercado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CartMercadoSchema)) body: CartMercadoDTO,
  ): Promise<CartDTO> {
    return this.service.definirMercado(id, body);
  }

  /** Fecha a compra: guarda no histórico e esvazia o carrinho. */
  @Post(':id/finalizar')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  finalizar(@Param('id') id: string, @CurrentUser() user: AuthedUser): Promise<CompraDTO> {
    return this.service.finalizar(id, user.id);
  }

  @Patch(':id/items/:lineId')
  alterarQuantidade(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body(new ZodValidationPipe(SetQuantitySchema)) body: z.infer<typeof SetQuantitySchema>,
  ): Promise<CartDTO> {
    return this.service.alterarQuantidade(id, lineId, body.quantity);
  }

  @Delete(':id/items/:lineId')
  removerItem(@Param('id') id: string, @Param('lineId') lineId: string): Promise<CartDTO> {
    return this.service.removerItem(id, lineId);
  }

  @Put(':id/limite')
  definirLimite(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetLimiteSchema)) body: SetLimiteInput,
  ): Promise<CartDTO> {
    return this.service.definirLimite(id, body.limiteCents);
  }
}
