import { InvalidPriceError } from '../errors.js';
import { Money, MoneyJSON } from '../money/Money.js';

/** De onde veio o preço — relevante para confiança/anti-fraude. */
export type PriceSource = 'manual' | 'qr' | 'foto';

export interface PriceObservationJSON {
  readonly id: string;
  readonly produtoId: string;
  readonly mercadoId: string;
  readonly mercadoNome?: string;
  readonly price: MoneyJSON;
  readonly source: PriceSource;
  readonly reporterId: string;
  readonly observedAt: string; // ISO
}

/**
 * Observação de preço reportada por um usuário: "produto X custou Y no mercado Z
 * em tal data". É o dado colaborativo bruto — imutável. Estatísticas (média,
 * tendência) e detecção de fraude são calculadas sobre coleções dessas observações.
 */
export class PriceObservation {
  readonly id: string;
  readonly produtoId: string;
  readonly mercadoId: string;
  /** Nome do mercado (denormalizado) — mercados reais do OSM não estão no seed. */
  readonly mercadoNome: string | undefined;
  readonly price: Money;
  readonly source: PriceSource;
  /** Quem reportou (para reputação/anti-fraude). */
  readonly reporterId: string;
  readonly observedAt: Date;

  constructor(params: {
    id: string;
    produtoId: string;
    mercadoId: string;
    mercadoNome?: string;
    price: Money;
    source: PriceSource;
    reporterId: string;
    observedAt: Date;
  }) {
    if (params.price.isNegative() || params.price.isZero()) {
      throw new InvalidPriceError('Preço observado deve ser maior que zero');
    }
    if (Number.isNaN(params.observedAt.getTime())) {
      throw new InvalidPriceError('Data de observação inválida');
    }
    this.id = params.id;
    this.produtoId = params.produtoId;
    this.mercadoId = params.mercadoId;
    this.mercadoNome = params.mercadoNome;
    this.price = params.price;
    this.source = params.source;
    this.reporterId = params.reporterId;
    this.observedAt = new Date(params.observedAt.getTime());
    Object.freeze(this);
  }

  toJSON(): PriceObservationJSON {
    return {
      id: this.id,
      produtoId: this.produtoId,
      mercadoId: this.mercadoId,
      ...(this.mercadoNome !== undefined ? { mercadoNome: this.mercadoNome } : {}),
      price: this.price.toJSON(),
      source: this.source,
      reporterId: this.reporterId,
      observedAt: this.observedAt.toISOString(),
    };
  }
}
