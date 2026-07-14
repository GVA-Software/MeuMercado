import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Produto } from '@meumercado/domain';
import type { CreateProdutoInput, EanLookupDTO, ProdutoDTO } from '@meumercado/contracts';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from '../pricing/price-observation.repository.js';
import { PRODUTO_REPOSITORY, type ProdutoRepository } from './produtos.repository.js';
import { OpenFoodFactsService } from './openfoodfacts.service.js';

@Injectable()
export class ProdutosService {
  constructor(
    @Inject(PRODUTO_REPOSITORY) private readonly repo: ProdutoRepository,
    @Inject(PRICE_OBSERVATION_REPOSITORY) private readonly observations: PriceObservationRepository,
    private readonly off: OpenFoodFactsService,
  ) {}

  /**
   * Busca por código de barras (ao bipar). Nossa base primeiro (cresce a cada
   * bip); se não houver, sugere o nome do Open Food Facts — SEM criar o produto
   * (só vira produto quando o usuário confirmar a adição).
   */
  async lookupPorEan(ean: string): Promise<EanLookupDTO> {
    const existente = await this.repo.findByEan(ean);
    if (existente) return { ean, produto: existente.toJSON(), sugestaoNome: null };
    return { ean, produto: null, sugestaoNome: await this.off.nomePorEan(ean) };
  }

  async listar(): Promise<ProdutoDTO[]> {
    return (await this.repo.findAll()).map((p) => p.toJSON());
  }

  async buscar(termo: string, limit: number): Promise<ProdutoDTO[]> {
    return (await this.repo.search(termo, limit)).map((p) => p.toJSON());
  }

  async obter(id: string): Promise<ProdutoDTO> {
    const produto = await this.repo.findById(id);
    if (!produto) {
      throw new NotFoundException(`Produto não encontrado: ${id}`);
    }
    return produto.toJSON();
  }

  /** Cria um produto no catálogo (aberto — alimentado pelos usuários). */
  async criar(input: CreateProdutoInput): Promise<ProdutoDTO> {
    const produto = new Produto({
      id: randomUUID(),
      nome: input.nome,
      categoria: input.categoria ?? 'Outros',
      unidade: input.unidade ?? 'un',
      ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      ...(input.ean !== undefined ? { ean: input.ean } : {}),
    });
    await this.repo.add(produto);
    return produto.toJSON();
  }

  /**
   * Junta dois produtos duplicados: move todas as observações de preço de `fromId`
   * para `intoId` e remove o produto `fromId`. Fica com um único produto (o de
   * `intoId`) reunindo os preços dos dois — útil quando a mesma mercadoria vem com
   * nomes diferentes de mercados diferentes.
   */
  async merge(fromId: string, intoId: string): Promise<ProdutoDTO> {
    if (fromId === intoId) {
      throw new BadRequestException('Selecione dois produtos diferentes.');
    }
    const from = await this.repo.findById(fromId);
    const into = await this.repo.findById(intoId);
    if (!from) throw new NotFoundException('Produto a juntar não encontrado.');
    if (!into) throw new NotFoundException('Produto de destino não encontrado.');
    await this.observations.reassignProduto(fromId, intoId);
    await this.repo.delete(fromId);
    return into.toJSON();
  }
}
