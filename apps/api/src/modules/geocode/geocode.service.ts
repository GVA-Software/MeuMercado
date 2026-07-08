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
  private readonly fwdCache = new Map<string, { lat: number; lng: number } | null>();

  /**
   * Geocoding direto (endereço → coordenada). `null` se não encontrar.
   * Expande abreviações (AV→Avenida — o Nominatim não casa "AV") e, se falhar,
   * tenta uma forma simplificada "rua, cidade, UF".
   */
  async geocode(endereco: string): Promise<{ lat: number; lng: number } | null> {
    const key = endereco.trim().toLowerCase();
    if (!key) return null;
    const cached = this.fwdCache.get(key);
    if (cached !== undefined) return cached;

    const expandido = expandirAbrev(endereco);
    let coord = await this.nominatim(expandido);
    if (!coord) {
      const simples = ruaCidadeUf(expandido);
      if (simples && simples !== expandido) coord = await this.nominatim(simples);
    }
    this.fwdCache.set(key, coord);
    return coord;
  }

  private async nominatim(q: string): Promise<{ lat: number; lng: number } | null> {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1` +
      `&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MeuMercado/1.0 (app de compras)' },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const hit = data[0];
      if (!hit?.lat || !hit?.lon) return null;
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch (e) {
      this.logger.warn(`Geocode direto falhou: ${String(e)}`);
      return null;
    }
  }

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

/** Expande o tipo de logradouro (o Nominatim não casa "AV DOS..."). */
function expandirAbrev(s: string): string {
  return s
    .replace(/^\s*AV\.?\s+/i, 'Avenida ')
    .replace(/^\s*R\.?\s+/i, 'Rua ')
    .replace(/^\s*AL\.?\s+/i, 'Alameda ')
    .replace(/^\s*P[çc]\.?\s+/i, 'Praça ')
    .replace(/^\s*ROD\.?\s+/i, 'Rodovia ')
    .replace(/^\s*TV\.?\s+/i, 'Travessa ')
    .replace(/^\s*EST\.?\s+/i, 'Estrada ');
}

/** "rua, número, bairro, cidade, UF" → "rua, cidade, UF" (mais fácil de casar). */
function ruaCidadeUf(s: string): string | null {
  const parts = s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
}
