import { Injectable, Logger } from '@nestjs/common';

/**
 * Geocoding reverso (coordenada → endereço) via **Nominatim** (OpenStreetMap),
 * sem API paga. Feito no servidor (User-Agent correto + cache futuro) em vez de
 * no navegador, respeitando a política de uso do Nominatim.
 *
 * TODO(escala): auto-hospedar Nominatim/Photon em vez do endpoint público.
 */
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  private readonly cache = new Map<string, string | null>();

  async reverse(lat: number, lng: number): Promise<string | null> {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&accept-language=pt-BR`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MeuMercado/1.0 (app de compras)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { display_name?: string };
      const endereco = data.display_name ?? null;
      this.cache.set(key, endereco);
      return endereco;
    } catch (e) {
      this.logger.warn(`Reverse geocode falhou: ${String(e)}`);
      return null;
    }
  }
}
