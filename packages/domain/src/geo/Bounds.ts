import { InvalidBoundsError } from '../errors.js';
import { GeoPoint } from './GeoPoint.js';

/**
 * Caixa delimitadora (bounding box) imutável, definida pelos cantos sudoeste
 * (mínimos) e nordeste (máximos). Útil para viewport do mapa e filtros geoespaciais.
 */
export class Bounds {
  readonly southWest: GeoPoint;
  readonly northEast: GeoPoint;

  constructor(southWest: GeoPoint, northEast: GeoPoint) {
    if (southWest.latitude > northEast.latitude) {
      throw new InvalidBoundsError('southWest.latitude não pode ser maior que northEast.latitude');
    }
    if (southWest.longitude > northEast.longitude) {
      throw new InvalidBoundsError(
        'southWest.longitude não pode ser maior que northEast.longitude',
      );
    }
    this.southWest = southWest;
    this.northEast = northEast;
    Object.freeze(this);
  }

  /** Constrói a partir de uma lista de pontos (menor caixa que contém todos). */
  static fromPoints(points: readonly GeoPoint[]): Bounds {
    if (points.length === 0) {
      throw new InvalidBoundsError('É preciso ao menos um ponto para calcular Bounds');
    }
    let minLat = Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let maxLng = -Infinity;
    for (const p of points) {
      minLat = Math.min(minLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLat = Math.max(maxLat, p.latitude);
      maxLng = Math.max(maxLng, p.longitude);
    }
    return new Bounds(new GeoPoint(minLat, minLng), new GeoPoint(maxLat, maxLng));
  }

  contains(point: GeoPoint): boolean {
    return (
      point.latitude >= this.southWest.latitude &&
      point.latitude <= this.northEast.latitude &&
      point.longitude >= this.southWest.longitude &&
      point.longitude <= this.northEast.longitude
    );
  }

  /** Centro geográfico da caixa. */
  center(): GeoPoint {
    return new GeoPoint(
      (this.southWest.latitude + this.northEast.latitude) / 2,
      (this.southWest.longitude + this.northEast.longitude) / 2,
    );
  }

  /** [minLng, minLat, maxLng, maxLat] — formato de bbox do GeoJSON. */
  toBBox(): [number, number, number, number] {
    return [
      this.southWest.longitude,
      this.southWest.latitude,
      this.northEast.longitude,
      this.northEast.latitude,
    ];
  }
}
