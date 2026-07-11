import { Money, MoneyJSON } from '../money/Money.js';

export type InsightType =
  | 'tendencia-alta'
  | 'tendencia-baixa'
  | 'mais-barato-em'
  | 'menor-preco-historico'
  | 'cesta-otima'
  | 'destaque'
  | 'oportunidade';

export interface InsightJSON {
  readonly type: InsightType;
  readonly urgente: boolean;
  readonly titulo: string;
  readonly sub: string;
  readonly emoji: string;
  readonly produtoId?: string;
  readonly mercadoId?: string;
  readonly economia?: MoneyJSON;
}

/**
 * Um insight da Nina: uma conclusão explicável derivada de estatística (não de
 * um LLM). Imutável. `economia` quantifica o benefício quando aplicável, para a
 * UI poder ordenar por impacto.
 */
export class Insight {
  readonly type: InsightType;
  readonly urgente: boolean;
  readonly titulo: string;
  readonly sub: string;
  readonly emoji: string;
  readonly produtoId: string | undefined;
  readonly mercadoId: string | undefined;
  readonly economia: Money | undefined;

  constructor(params: {
    type: InsightType;
    urgente: boolean;
    titulo: string;
    sub: string;
    emoji: string;
    produtoId?: string;
    mercadoId?: string;
    economia?: Money;
  }) {
    this.type = params.type;
    this.urgente = params.urgente;
    this.titulo = params.titulo;
    this.sub = params.sub;
    this.emoji = params.emoji;
    this.produtoId = params.produtoId;
    this.mercadoId = params.mercadoId;
    this.economia = params.economia;
    Object.freeze(this);
  }

  toJSON(): InsightJSON {
    return {
      type: this.type,
      urgente: this.urgente,
      titulo: this.titulo,
      sub: this.sub,
      emoji: this.emoji,
      ...(this.produtoId !== undefined ? { produtoId: this.produtoId } : {}),
      ...(this.mercadoId !== undefined ? { mercadoId: this.mercadoId } : {}),
      ...(this.economia !== undefined ? { economia: this.economia.toJSON() } : {}),
    };
  }
}
