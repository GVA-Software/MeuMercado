import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MercadoDTO } from '@meumercado/contracts';
import { api } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { AppLogo, Btn } from '../../ui/kit';

// Estilo raster sobre OpenStreetMap — sem chave/API paga ("nosso Maps").
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const DEFAULT_CENTER: [number, number] = [-46.58, -23.58];

function formatDist(m?: number): string | null {
  if (m === undefined) return null;
  return m >= 1000
    ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
    : `${m} m`;
}

export function MapaScreen() {
  const { T } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [mercados, setMercados] = useState<MercadoDTO[]>([]);
  const [selecionado, setSelecionado] = useState<MercadoDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: DEFAULT_CENTER,
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setMercados(await api.mercados());
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  // Pins: tocar num pin abre o sheet do mercado.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || mercados.length === 0) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = mercados.map((merc) => {
      const marker = new maplibregl.Marker({ color: T.primary })
        .setLngLat([merc.localizacao.lng, merc.localizacao.lat])
        .addTo(map);
      const el = marker.getElement();
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelecionado(merc);
      });
      return marker;
    });

    const bounds = new maplibregl.LngLatBounds();
    mercados.forEach((m) => bounds.extend([m.localizacao.lng, m.localizacao.lat]));
    if (userMarkerRef.current) bounds.extend(userMarkerRef.current.getLngLat());
    map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
  }, [ready, mercados, T.primary]);

  function localizar() {
    if (!navigator.geolocation) {
      setErro('Geolocalização não suportada neste navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const map = mapRef.current;
        if (!map) return;
        userMarkerRef.current?.remove();
        userMarkerRef.current = new maplibregl.Marker({ color: T.nina })
          .setLngLat([longitude, latitude])
          .addTo(map);
        map.flyTo({ center: [longitude, latitude], zoom: 13 });
        void api
          .mercadosProximos(latitude, longitude)
          .then(setMercados)
          .catch(() => {});
      },
      () => setErro('Não consegui obter sua localização (permissão negada?).'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function abrir(m: MercadoDTO) {
    mapRef.current?.flyTo({ center: [m.localizacao.lng, m.localizacao.lat], zoom: 15 });
    setSelecionado(m);
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: T.surface,
          padding: '16px 16px 12px',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppLogo size={16} />
          <Btn small onClick={localizar}>
            📍 Minha localização
          </Btn>
        </div>
        <p style={{ color: T.muted, fontSize: 13, margin: '8px 0 0' }}>
          Mercados perto de você — sobre OpenStreetMap
        </p>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '52vh', background: T.card }} />

      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}
        {mercados.map((m) => {
          const dist = formatDist(m.distanciaMetros);
          return (
            <button
              key={m.id}
              onClick={() => abrir(m)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: `0 1px 4px ${T.shadow}`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: T.primaryBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                🏬
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: T.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{m.nome}</p>
                <p style={{ color: T.muted, fontSize: 12, margin: '2px 0 0' }}>
                  {m.rede ?? 'Mercado'}
                  {dist ? ` · ${dist}` : ''}
                </p>
              </div>
              <span style={{ color: T.primary, fontSize: 18 }}>→</span>
            </button>
          );
        })}
      </div>

      {selecionado && <MercadoSheet mercado={selecionado} onClose={() => setSelecionado(null)} />}
    </div>
  );
}

function MercadoSheet({ mercado, onClose }: { mercado: MercadoDTO; onClose: () => void }) {
  const { T } = useTheme();
  const { lat, lng } = mercado.localizacao;
  const dist = formatDist(mercado.distanciaMetros);
  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  const navBtn = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 12px',
    borderRadius: 14,
    color: '#FFF',
    fontWeight: 800,
    fontSize: 15,
    textDecoration: 'none',
  } as const;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: T.surface,
          borderRadius: '24px 24px 0 0',
          padding: '18px 20px 40px',
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: T.border,
            borderRadius: 99,
            margin: '0 auto 16px',
          }}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: T.primaryBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
            }}
          >
            🏬
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: T.text, fontSize: 17, fontWeight: 800, margin: 0 }}>
              {mercado.nome}
            </p>
            <p style={{ color: T.muted, fontSize: 13, margin: '2px 0 0' }}>
              {mercado.rede ?? 'Mercado'}
              {dist ? ` · a ${dist}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: T.muted,
              fontSize: 20,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            background: T.card,
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 16 }}>📍</span>
          <p style={{ color: T.sub, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            {mercado.endereco ?? 'Endereço não disponível'}
          </p>
        </div>

        <p
          style={{
            color: T.muted,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            margin: '0 0 8px',
          }}
        >
          COMO CHEGAR
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...navBtn, background: '#33CCFF' }}
          >
            🧭 Waze
          </a>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...navBtn, background: '#1DB954' }}
          >
            🗺️ Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
