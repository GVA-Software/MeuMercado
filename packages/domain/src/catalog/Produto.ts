import { InvalidProductError } from '../errors.js';
import { Categoria, isCategoria } from './Categoria.js';

/** Unidade de medida na qual o produto é precificado. */
export type Unidade = 'un' | 'kg' | 'g' | 'L' | 'ml' | 'duzia' | 'pacote';

export interface ProdutoJSON {
  readonly id: string;
  readonly nome: string;
  readonly categoria: Categoria;
  readonly unidade: Unidade;
  readonly emoji?: string;
}

/**
 * Produto do catálogo (ex.: "Arroz Branco 5kg"). Imutável. É a identidade contra
 * a qual observamos preços em diferentes mercados. Não guarda preço — preço é
 * uma observação separada (varia por mercado e no tempo).
 */
export class Produto {
  readonly id: string;
  readonly nome: string;
  readonly categoria: Categoria;
  readonly unidade: Unidade;
  readonly emoji: string | undefined;

  constructor(params: {
    id: string;
    nome: string;
    categoria: Categoria;
    unidade: Unidade;
    emoji?: string;
  }) {
    if (!params.id?.trim()) {
      throw new InvalidProductError('Produto precisa de id');
    }
    if (!params.nome?.trim()) {
      throw new InvalidProductError('Produto precisa de nome');
    }
    if (!isCategoria(params.categoria)) {
      throw new InvalidProductError(`Categoria inválida: ${params.categoria}`);
    }
    this.id = params.id;
    this.nome = params.nome.trim();
    this.categoria = params.categoria;
    this.unidade = params.unidade;
    this.emoji = params.emoji;
    Object.freeze(this);
  }

  toJSON(): ProdutoJSON {
    return {
      id: this.id,
      nome: this.nome,
      categoria: this.categoria,
      unidade: this.unidade,
      ...(this.emoji !== undefined ? { emoji: this.emoji } : {}),
    };
  }
}
