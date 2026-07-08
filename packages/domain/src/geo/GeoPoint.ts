import { InvalidCoordinateError } from '../errors.js';

/** Raio médio da Terra em metros (usado na distância de Haversine). */
const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Representação serializável de um ponto (formato leve para DTOs/JSON). */
export interface GeoPointJSON {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Ponto geográfico imutável (WGS84). Value object: dois pontos com as mesmas
 * coordenadas são considerados iguais. Valida o intervalo na construção.
 */
export class GeoPoint {
  readonly latitude: number;
  readonly longitude: number;

  constructor(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new InvalidCoordinateError('latitude', latitude);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new InvalidCoordinateError('longitude', longitude);
    }
    this.latitude = latitude;
    this.longitude = longitude;
    Object.freeze(this);
  }

  static from(json: GeoPointJSON): GeoPoint {
    return new GeoPoint(json.lat, json.lng);
  }

  /** Ordem [lng, lat] — convenção do GeoJSON/MapLibre. */
  static fromLngLat([lng, lat]: readonly [number, number]): GeoPoint {
    return new GeoPoint(lat, lng);
  }

  /** Distância em metros até outro ponto (fórmula de Haversine). */
  distanceTo(other: GeoPoint): number {
    const dLat = toRadians(other.latitude - this.latitude);
    const dLng = toRadians(other.longitude - this.longitude);
    const lat1 = toRadians(this.latitude);
    const lat2 = toRadians(other.latitude);

    const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  equals(other: GeoPoint): boolean {
    return this.latitude === other.latitude && this.longitude === other.longitude;
  }

  /** [lng, lat] para consumo por MapLibre/GeoJSON. */
  toLngLat(): [number, number] {
    return [this.longitude, this.latitude];
  }

  toJSON(): GeoPointJSON {
    return { lat: this.latitude, lng: this.longitude };
  }
}
