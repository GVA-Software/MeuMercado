import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import {
  AddCartItemSchema,
  SetLimiteSchema,
  type AddCartItemInput,
  type CartDTO,
  type SetLimiteInput,
} from '@meumercado/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CartService } from './cart.service.js';

const SetQuantitySchema = z.object({ quantity: z.number().int().min(1).max(999) });

@Controller('carts')
export class CartController {
  constructor(private readonly service: CartService) {}

  @Post()
  @HttpCode(201)
  criar(): CartDTO {
    return this.service.criar();
  }

  @Get(':id')
  obter(@Param('id') id: string): CartDTO {
    return this.service.obter(id);
  }

  @Post(':id/items')
  @HttpCode(201)
  adicionarItem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddCartItemSchema)) body: AddCartItemInput,
  ): CartDTO {
    return this.service.adicionarItem(id, body);
  }

  @Patch(':id/items/:lineId')
  alterarQuantidade(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body(new ZodValidationPipe(SetQuantitySchema)) body: z.infer<typeof SetQuantitySchema>,
  ): CartDTO {
    return this.service.alterarQuantidade(id, lineId, body.quantity);
  }

  @Delete(':id/items/:lineId')
  removerItem(@Param('id') id: string, @Param('lineId') lineId: string): CartDTO {
    return this.service.removerItem(id, lineId);
  }

  @Put(':id/limite')
  definirLimite(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetLimiteSchema)) body: SetLimiteInput,
  ): CartDTO {
    return this.service.definirLimite(id, body.limiteCents);
  }
}
