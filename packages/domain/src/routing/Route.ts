import { InvalidRouteError } from '../errors.js';
import { Bounds } from '../geo/Bounds.js';
import { GeoPoint } from '../geo/GeoPoint.js';
import { RouteStep } from './RouteStep.js';

/**
 * Rota calculada de A→B. Imutável. Agrega geometria (polilinha de pontos),
 * a lista de manobras e os totais de distância/tempo. Encapsula regras de
 * apresentação (ETA, formatação) para não espalhá-las pela UI.
 */
export class Route {
  readonly geometry: readonly GeoPoint[];
  readonly steps: readonly RouteStep[];
  readonly distanceMeters: number;
  readonly durationSeconds: number;

  constructor(params: {
    geometry: readonly GeoPoint[];
    steps: readonly RouteStep[];
    distanceMeters: number;
    durationSeconds: number;
  }) {
    if (params.geometry.length < 2) {
      throw new InvalidRouteError('Uma rota precisa de pelo menos 2 pontos na geometria');
    }
    if (params.distanceMeters < 0 || params.durationSeconds < 0) {
      throw new InvalidRouteError('Distância e duração não podem ser negativas');
    }
    this.geometry = Object.freeze([...params.geometry]);
    this.steps = Object.freeze([...params.steps]);
    this.distanceMeters = params.distanceMeters;
    this.durationSeconds = params.durationSeconds;
    Object.freeze(this);
  }

  get origin(): GeoPoint {
    return this.geometry[0]!;
  }

  get destination(): GeoPoint {
    return this.geometry[this.geometry.length - 1]!;
  }

  /** Caixa que envolve a rota inteira (para dar "fit" no mapa). */
  bounds(): Bounds {
    return Bounds.fromPoints(this.geometry);
  }

  /** Horário estimado de chegada a partir de um instante de partida. */
  estimatedArrival(departure: Date): Date {
    return new Date(departure.getTime() + this.durationSeconds * 1000);
  }

  /** "1,2 km" ou "850 m" — pt-BR. */
  formatDistance(): string {
    if (this.distanceMeters >= 1000) {
      return `${(this.distanceMeters / 1000).toLocaleString('pt-BR', {
        maximumFractionDigits: 1,
      })} km`;
    }
    return `${Math.round(this.distanceMeters)} m`;
  }

  /** "1 h 5 min" ou "12 min" — pt-BR. */
  formatDuration(): string {
    const totalMin = Math.round(this.durationSeconds / 60);
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (hours > 0) {
      return `${hours} h ${minutes} min`;
    }
    return `${minutes} min`;
  }
}
