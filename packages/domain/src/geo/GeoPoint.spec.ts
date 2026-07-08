import { describe, it, expect } from 'vitest';
import { GeoPoint } from './GeoPoint.js';
import { InvalidCoordinateError } from '../errors.js';

describe('GeoPoint', () => {
  it('constrói com coordenadas válidas e é imutável', () => {
    const p = new GeoPoint(-23.5505, -46.6333);
    expect(p.latitude).toBe(-23.5505);
    expect(p.longitude).toBe(-46.6333);
    expect(Object.isFrozen(p)).toBe(true);
  });

  it.each([
    ['latitude', 91, 0],
    ['latitude', -91, 0],
    ['longitude', 0, 181],
    ['longitude', 0, -181],
    ['latitude', NaN, 0],
  ])('rejeita %s fora do intervalo', (_campo, lat, lng) => {
    expect(() => new GeoPoint(lat, lng)).toThrow(InvalidCoordinateError);
  });

  it('calcula distância de Haversine (SP → RJ ≈ 360 km)', () => {
    const sp = new GeoPoint(-23.5505, -46.6333);
    const rj = new GeoPoint(-22.9068, -43.1729);
    const km = sp.distanceTo(rj) / 1000;
    expect(km).toBeGreaterThan(355);
    expect(km).toBeLessThan(365);
  });

  it('distância para si mesmo é zero', () => {
    const p = new GeoPoint(10, 20);
    expect(p.distanceTo(p)).toBe(0);
  });

  it('equals compara por valor', () => {
    expect(new GeoPoint(1, 2).equals(new GeoPoint(1, 2))).toBe(true);
    expect(new GeoPoint(1, 2).equals(new GeoPoint(1, 3))).toBe(false);
  });

  it('converte de/para [lng, lat] (GeoJSON)', () => {
    const p = GeoPoint.fromLngLat([-46.6333, -23.5505]);
    expect(p.latitude).toBe(-23.5505);
    expect(p.toLngLat()).toEqual([-46.6333, -23.5505]);
    expect(p.toJSON()).toEqual({ lat: -23.5505, lng: -46.6333 });
  });
});
