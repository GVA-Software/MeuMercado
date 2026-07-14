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
  readonly ean?: string;
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
  /**
   * Chave de deduplicação externa (ex.: `nfce:<cnpj>:<código>`). Distingue SKUs
   * de mesma descrição (tamanhos diferentes) vindos da nota fiscal. Interno — não
   * é serializado no DTO.
   */
  readonly codigoExterno: string | undefined;
  /**
   * Código de barras (EAN-13/EAN-8/UPC). GLOBAL — o mesmo em qualquer loja/lote —,
   * diferente do `codigoExterno` (SKU por-mercado). Serializado no DTO; usado para
   * casar o produto ao bipar e unificar o mesmo item entre mercados.
   */
  readonly ean: string | undefined;

  constructor(params: {
    id: string;
    nome: string;
    categoria: Categoria;
    unidade: Unidade;
    emoji?: string;
    codigoExterno?: string;
    ean?: string;
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
    this.codigoExterno = params.codigoExterno;
    this.ean = params.ean;
    Object.freeze(this);
  }

  toJSON(): ProdutoJSON {
    return {
      id: this.id,
      nome: this.nome,
      categoria: this.categoria,
      unidade: this.unidade,
      ...(this.emoji !== undefined ? { emoji: this.emoji } : {}),
      ...(this.ean !== undefined ? { ean: this.ean } : {}),
    };
  }
}
