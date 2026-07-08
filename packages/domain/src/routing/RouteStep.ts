import { GeoPoint } from '../geo/GeoPoint.js';

/** Tipos de manobra suportados na navegação turn-by-turn. */
export type ManeuverType =
  | 'depart'
  | 'turn-left'
  | 'turn-right'
  | 'turn-slight-left'
  | 'turn-slight-right'
  | 'turn-sharp-left'
  | 'turn-sharp-right'
  | 'continue'
  | 'roundabout'
  | 'merge'
  | 'fork'
  | 'arrive';

/**
 * Passo (manobra) de uma rota. Imutável. Representa uma instrução de navegação
 * localizada — ex.: "Vire à direita na Rua X" com distância/tempo até a próxima.
 */
export class RouteStep {
  readonly instruction: string;
  readonly maneuver: ManeuverType;
  readonly location: GeoPoint;
  readonly distanceMeters: number;
  readonly durationSeconds: number;

  constructor(params: {
    instruction: string;
    maneuver: ManeuverType;
    location: GeoPoint;
    distanceMeters: number;
    durationSeconds: number;
  }) {
    this.instruction = params.instruction;
    this.maneuver = params.maneuver;
    this.location = params.location;
    this.distanceMeters = Math.max(0, params.distanceMeters);
    this.durationSeconds = Math.max(0, params.durationSeconds);
    Object.freeze(this);
  }
}
