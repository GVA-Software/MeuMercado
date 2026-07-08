import { InvalidMarketError } from '../errors.js';
import { GeoPoint, GeoPointJSON } from '../geo/GeoPoint.js';

export interface MercadoJSON {
  readonly id: string;
  readonly nome: string;
  readonly rede?: string;
  readonly endereco?: string;
  readonly localizacao: GeoPointJSON;
}

/**
 * Mercado/loja física, com localização geográfica. É a ponte entre o domínio de
 * compras e a aba Mapa: a partir da `localizacao` (GeoPoint) calculamos mercados
 * próximos, o mais barato por perto e a rota até lá.
 */
export class Mercado {
  readonly id: string;
  readonly nome: string;
  /** Rede/bandeira (ex.: "Assaí", "Carrefour"), quando aplicável. */
  readonly rede: string | undefined;
  readonly endereco: string | undefined;
  readonly localizacao: GeoPoint;

  constructor(params: {
    id: string;
    nome: string;
    localizacao: GeoPoint;
    rede?: string;
    endereco?: string;
  }) {
    if (!params.id?.trim()) {
      throw new InvalidMarketError('Mercado precisa de id');
    }
    if (!params.nome?.trim()) {
      throw new InvalidMarketError('Mercado precisa de nome');
    }
    this.id = params.id;
    this.nome = params.nome.trim();
    this.localizacao = params.localizacao;
    this.rede = params.rede;
    this.endereco = params.endereco;
    Object.freeze(this);
  }

  /** Distância em metros até um ponto (ex.: posição do usuário). */
  distanceToMeters(from: GeoPoint): number {
    return this.localizacao.distanceTo(from);
  }

  toJSON(): MercadoJSON {
    return {
      id: this.id,
      nome: this.nome,
      localizacao: this.localizacao.toJSON(),
      ...(this.rede !== undefined ? { rede: this.rede } : {}),
      ...(this.endereco !== undefined ? { endereco: this.endereco } : {}),
    };
  }
}
