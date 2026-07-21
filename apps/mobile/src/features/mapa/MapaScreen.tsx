import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MercadoDTO } from '@meumercado/contracts';
import { api, ApiError, mensagemDeErro } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { AppLogo, Btn, EmptyState } from '../../ui/kit';
import type { MapFocus } from '../../app/nav';

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

const DEFAULT_CENTER: [number, number] = [-46.63, -23.55];
// Raios disponíveis (metros) — o usuário escolhe; 5 km é o padrão.
const RAIOS = [1000, 2000, 5000, 7000, 10000];
const RAIO_PADRAO = 5000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function formatDist(m?: number): string | null {
  if (m === undefined) return null;
  return m >= 1000
    ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
    : `${m} m`;
}

interface UserSheet {
  endereco: string | null;
  loading: boolean;
}

export function MapaScreen({ focus }: { focus?: MapFocus | null }) {
  const { T } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ id: string; marker: maplibregl.Marker }[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const focusMarkerRef = useRef<maplibregl.Marker | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  // Geração da busca: invalida enriquecimentos/retries de uma busca antiga (o usuário
  // trocou de lugar/raio) — evita aplicar resultado velho por cima do novo.
  const buscaGenRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [todosMercados, setTodosMercados] = useState<MercadoDTO[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  // Servidor/banco frios (Render+Neon dormem): mostra "acordando" e re-tenta.
  const [acordando, setAcordando] = useState(false);
  const [raioMetros, setRaioMetros] = useState(RAIO_PADRAO);

  // Busca uma vez no raio máximo e FILTRA no cliente — trocar o raio é instantâneo.
  const mercados = useMemo(
    () => todosMercados.filter((m) => (m.distanciaMetros ?? 0) <= raioMetros),
    [todosMercados, raioMetros],
  );
  const [selMercado, setSelMercado] = useState<MercadoDTO | null>(null);
  const [selUser, setSelUser] = useState<UserSheet | null>(null);
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

  // Enquadra o mapa em todos os mercados encontrados (+ você) — "visão geral".
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || mercados.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    mercados.forEach((m) => bounds.extend([m.localizacao.lng, m.localizacao.lat]));
    if (userMarkerRef.current) bounds.extend(userMarkerRef.current.getLngLat());
    map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
  }, [mercados]);

  // Pins dos mercados encontrados (nenhum por padrão).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = mercados.map((merc) => {
      // Mercado com preço reportado (veio das nossas NFs) = pin verde e em destaque;
      // os demais (só OpenStreetMap) ficam no laranja padrão.
      const temPreco = (merc.precos ?? 0) > 0;
      const marker = new maplibregl.Marker({ color: temPreco ? T.green : T.primary })
        .setLngLat([merc.localizacao.lng, merc.localizacao.lat])
        .addTo(map);
      const el = marker.getElement();
      el.style.cursor = 'pointer';
      el.style.transition = 'filter 0.15s';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelMercado(merc);
      });
      return { id: merc.id, marker };
    });

    fitAll();
  }, [ready, mercados, T.primary, T.green, fitAll]);

  // Destaca o pin do mercado selecionado (glow + escala) para não se perder entre
  // pins próximos.
  useEffect(() => {
    markersRef.current.forEach(({ id, marker }) => {
      const el = marker.getElement();
      const sel = selMercado?.id === id;
      el.style.filter = sel ? 'drop-shadow(0 0 3px #FFD400) drop-shadow(0 0 7px #FFD400)' : '';
      el.style.zIndex = sel ? '5' : '';
      const svg = el.querySelector('svg');
      if (svg) {
        svg.style.transformOrigin = 'bottom center';
        svg.style.transform = sel ? 'scale(1.35)' : '';
        svg.style.transition = 'transform 0.15s';
      }
    });
  }, [selMercado, mercados]);

  // Foco vindo de outra aba ("Ver no mapa" nos Preços): fixa um pin dourado no
  // mercado e abre o cartão com endereço + navegação.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    focusMarkerRef.current?.remove();
    const sintetico: MercadoDTO = {
      id: 'focus',
      nome: focus.nome,
      localizacao: { lat: focus.lat, lng: focus.lng },
      ...(focus.endereco ? { endereco: focus.endereco } : {}),
    };
    const fm = new maplibregl.Marker({ color: '#FFB300' })
      .setLngLat([focus.lng, focus.lat])
      .addTo(map);
    const el = fm.getElement();
    el.style.filter = 'drop-shadow(0 0 4px #FFD400) drop-shadow(0 0 8px #FFD400)';
    el.style.zIndex = '6';
    el.style.cursor = 'pointer';
    // Clicar no pin amarelo reabre o cartão do mercado.
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelMercado(sintetico);
    });
    focusMarkerRef.current = fm;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: 16, duration: 800 });
    setSelMercado(sintetico);
  }, [ready, focus]);

  function buscarMercados(lat: number, lng: number) {
    const gen = ++buscaGenRef.current; // invalida buscas/enriquecimentos anteriores
    setBuscando(true);
    setErro(null);
    // Nova busca: some o pin dourado de foco e fecha o cartão — o mapa volta ao
    // normal (o mercado, se estiver por perto, vira um pin comum).
    focusMarkerRef.current?.remove();
    focusMarkerRef.current = null;
    setSelMercado(null);
    const map = mapRef.current;
    if (map) {
      userMarkerRef.current?.remove();
      const um = new maplibregl.Marker({ color: T.nina }).setLngLat([lng, lat]).addTo(map);
      um.getElement().style.cursor = 'pointer';
      um.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        void abrirMinhaLoc(lat, lng);
      });
      userMarkerRef.current = um;
      map.flyTo({ center: [lng, lat], zoom: 12 });
    }
    void buscarComRetry(lat, lng, gen);
  }

  const temOsm = (ms: MercadoDTO[]) => ms.some((m) => m.id.startsWith('osm-'));

  /**
   * Busca no raio MÁXIMO uma vez; a régua filtra no cliente. Com RETRY: uma resposta
   * VAZIA ou um erro de "servidor frio" (status 0 / rede / 5xx) NÃO viram "Nenhum
   * mercado" na hora — o Render e o Neon dormem e o 1º acesso pode vir vazio/lento.
   * Re-tenta com backoff mostrando "acordando"; só desiste depois de esgotar.
   */
  async function buscarComRetry(lat: number, lng: number, gen: number) {
    const MAX = 6;
    for (let tentativa = 0; tentativa < MAX; tentativa++) {
      if (gen !== buscaGenRef.current) return; // busca substituída por outra
      try {
        const near = await api.mercadosProximos(lat, lng, Math.max(...RAIOS));
        if (near.length === 0 && tentativa < MAX - 1) {
          // Vazio pode ser transitório (banco/OSM frio) → espera e re-tenta.
          setAcordando(true);
          await esperar(Math.min(1500 + tentativa * 800, 5000));
          continue;
        }
        if (gen !== buscaGenRef.current) return;
        setTodosMercados(near);
        setBuscou(true);
        setAcordando(false);
        // Sobe pro MENOR raio que tem algum mercado (nunca abre "vazio" à toa).
        setRaioMetros((atual) => {
          if (near.some((m) => (m.distanciaMetros ?? 0) <= atual)) return atual;
          return RAIOS.find((r) => near.some((m) => (m.distanciaMetros ?? 0) <= r)) ?? atual;
        });
        setBuscando(false);
        // Veio só os NOSSOS (verdes) e nenhum supermercado do OSM (laranja)? O cache
        // daquela área ainda está frio no servidor — enriquece em 2º plano (o Overpass
        // é lento e cacheia depois; re-buscar pega os pinos laranjas sem travar a tela).
        if (!temOsm(near)) void enriquecerComOsm(lat, lng, gen);
        return;
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        // status 0 (timeout/rede) ou 5xx = servidor frio → re-tenta. Outros = erro real.
        const frio = status === 0 || status >= 500;
        if (frio && tentativa < MAX - 1) {
          setAcordando(true);
          await esperar(Math.min(1500 + tentativa * 800, 5000));
          continue;
        }
        if (gen !== buscaGenRef.current) return;
        setErro(mensagemDeErro(e));
        setAcordando(false);
        setBuscando(false);
        return;
      }
    }
    if (gen !== buscaGenRef.current) return;
    // Esgotou tudo vazio: aí sim é "nenhum mercado" de verdade.
    setTodosMercados([]);
    setBuscou(true);
    setAcordando(false);
    setBuscando(false);
  }

  /**
   * Enriquece o mapa com os supermercados do OSM (pins laranjas) em 2º plano, sem loader.
   * Cada re-busca também re-dispara a busca do OSM no servidor pra aquela área; quando ela
   * cacheia (Overpass é lento), os pins laranjas aparecem sozinhos. Silencioso e cancelável.
   */
  async function enriquecerComOsm(lat: number, lng: number, gen: number) {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await esperar(tentativa === 0 ? 6000 : 7000);
      if (gen !== buscaGenRef.current) return; // usuário trocou de busca
      try {
        const near = await api.mercadosProximos(lat, lng, Math.max(...RAIOS));
        if (gen !== buscaGenRef.current) return;
        if (temOsm(near)) {
          setTodosMercados(near); // agora com os pins laranjas do OSM
          return;
        }
      } catch {
        /* ignora — tenta de novo na próxima volta */
      }
    }
  }

  function buscarPerto() {
    if (!navigator.geolocation) {
      setErro('Geolocalização não suportada neste navegador.');
      return;
    }
    setBuscando(true);
    setErro(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        buscarMercados(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setErro('Não consegui obter sua localização (permissão negada?).');
        setBuscando(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function abrirMinhaLoc(lat: number, lng: number) {
    setSelUser({ endereco: null, loading: true });
    const endereco = await api.reverseGeocode(lat, lng).catch(() => null);
    setSelUser({ endereco, loading: false });
  }

  function abrirMercado(m: MercadoDTO) {
    mapRef.current?.flyTo({ center: [m.localizacao.lng, m.localizacao.lat], zoom: 15 });
    setSelMercado(m);
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
        <AppLogo size={16} />
        <p style={{ color: T.text, fontSize: 20, fontWeight: 800, margin: '10px 0 2px' }}>Mapa</p>
        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
          Mercados perto de você — sobre OpenStreetMap
        </p>
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '48vh', background: T.card }} />
        {buscando && (
          <CartLoading
            label={
              acordando
                ? 'Acordando o servidor… a primeira abertura leva uns segundos 🛒'
                : 'Buscando mercados perto de você…'
            }
          />
        )}
        {mercados.length > 0 && (
          <button
            onClick={fitAll}
            aria-label="Ver todos os mercados no mapa"
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: T.surface,
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 99,
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
            }}
          >
            <span style={{ fontSize: 15 }}>⤢</span> Ver todos
          </button>
        )}
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Régua de raio */}
        <div style={{ display: 'flex', gap: 6 }}>
          {RAIOS.map((r) => {
            const sel = raioMetros === r;
            return (
              <button
                key={r}
                onClick={() => setRaioMetros(r)}
                style={{
                  flex: 1,
                  background: sel ? T.primary : T.card,
                  color: sel ? '#FFF' : T.sub,
                  border: `1px solid ${sel ? T.primary : T.border}`,
                  borderRadius: 99,
                  padding: '8px 0',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {r / 1000} km
              </button>
            );
          })}
        </div>

        <Btn full onClick={buscarPerto} disabled={buscando}>
          {buscando
            ? acordando
              ? 'Acordando o servidor…'
              : 'Localizando…'
            : `📍 Mercados num raio de ${raioMetros / 1000} km`}
        </Btn>

        {erro && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: T.danger, fontSize: 13, margin: '0 0 8px' }}>{erro}</p>
            <Btn small onClick={buscarPerto}>
              Tentar de novo
            </Btn>
          </div>
        )}

        {!buscou && !erro && (
          <p style={{ color: T.muted, fontSize: 13, textAlign: 'center', margin: '4px 0' }}>
            Toque no botão para encontrar mercados perto de você.
          </p>
        )}

        {buscou &&
          mercados.length === 0 &&
          !erro &&
          (() => {
            // Tem mercado num raio MAIOR? Oferece um atalho pra ver os mais próximos.
            const maior = RAIOS.find(
              (r) => r > raioMetros && todosMercados.some((m) => (m.distanciaMetros ?? 0) <= r),
            );
            const qtd = maior
              ? todosMercados.filter((m) => (m.distanciaMetros ?? 0) <= maior).length
              : 0;
            return (
              <>
                <EmptyState
                  emoji="🔍"
                  titulo="Nenhum mercado neste raio"
                  sub={
                    maior
                      ? `Nada a ${raioMetros / 1000} km — o mais perto está um pouco além.`
                      : `Nenhum mercado num raio de ${raioMetros / 1000} km por aqui.`
                  }
                />
                {maior && (
                  <div style={{ textAlign: 'center' }}>
                    <Btn small onClick={() => setRaioMetros(maior)}>
                      Ver {qtd} {qtd === 1 ? 'mercado' : 'mercados'} em {maior / 1000} km
                    </Btn>
                  </div>
                )}
              </>
            );
          })()}

        {mercados.map((m) => {
          const dist = formatDist(m.distanciaMetros);
          const temPreco = (m.precos ?? 0) > 0;
          return (
            <button
              key={m.id}
              onClick={() => abrirMercado(m)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: T.surface,
                border: `1px solid ${temPreco ? T.green : T.border}`,
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
                  background: temPreco ? T.greenBg : T.primaryBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                {temPreco ? '🏷️' : '🏬'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: T.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{m.nome}</p>
                <p style={{ color: T.muted, fontSize: 12, margin: '2px 0 0' }}>
                  {m.rede ?? 'Mercado'}
                  {dist ? ` · ${dist}` : ''}
                </p>
                {temPreco && (
                  <p style={{ color: T.green, fontSize: 12, fontWeight: 700, margin: '3px 0 0' }}>
                    ✓ {m.precos} {m.precos === 1 ? 'produto' : 'produtos'} com preço aqui
                  </p>
                )}
              </div>
              <span style={{ color: T.primary, fontSize: 18 }}>→</span>
            </button>
          );
        })}
      </div>

      {selMercado && (
        <LocalSheet
          titulo={selMercado.nome}
          subtitulo={`${selMercado.rede ?? 'Mercado'}${
            formatDist(selMercado.distanciaMetros)
              ? ` · a ${formatDist(selMercado.distanciaMetros)}`
              : ''
          }${(selMercado.precos ?? 0) > 0 ? ` · ✓ ${selMercado.precos} com preço` : ''}`}
          endereco={selMercado.endereco ?? 'Endereço não disponível'}
          nav={selMercado.localizacao}
          onClose={() => setSelMercado(null)}
        />
      )}

      {selUser && (
        <LocalSheet
          titulo="Você está aqui"
          endereco={
            selUser.loading
              ? 'Buscando seu endereço…'
              : (selUser.endereco ?? 'Endereço não encontrado')
          }
          onClose={() => setSelUser(null)}
        />
      )}
    </div>
  );
}

function LocalSheet({
  titulo,
  subtitulo,
  endereco,
  nav,
  onClose,
}: {
  titulo: string;
  subtitulo?: string;
  endereco: string;
  nav?: { lat: number; lng: number };
  onClose: () => void;
}) {
  const { T } = useTheme();
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

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
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
          padding: '18px 20px calc(28px + env(safe-area-inset-bottom))',
          maxHeight: '82vh',
          overflowY: 'auto',
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
            {nav ? '🏬' : '📍'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: T.text, fontSize: 17, fontWeight: 800, margin: 0 }}>{titulo}</p>
            {subtitulo && (
              <p style={{ color: T.muted, fontSize: 13, margin: '2px 0 0' }}>{subtitulo}</p>
            )}
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
            marginBottom: nav ? 16 : 0,
          }}
        >
          <span style={{ fontSize: 16 }}>📍</span>
          <p style={{ color: T.sub, fontSize: 14, margin: 0, lineHeight: 1.5 }}>{endereco}</p>
        </div>

        {nav && (
          <>
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
                href={`https://waze.com/ul?ll=${nav.lat},${nav.lng}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...navBtn, background: '#33CCFF' }}
              >
                🧭 Waze
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${nav.lat},${nav.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...navBtn, background: '#1DB954' }}
              >
                🗺️ Google Maps
              </a>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Loading do mapa: nosso logo animado sobre o fundo desfocado. */
function CartLoading({ label = 'Buscando mercados perto de você…' }: { label?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 6,
        background: 'rgba(0,0,0,0.22)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <img
        src="/Loading.png"
        alt=""
        width={112}
        height={112}
        style={{
          animation: 'mm-logo-bob 1s ease-in-out infinite, mm-logo-glow 1.6s ease-in-out infinite',
        }}
      />
      <p
        style={{
          color: '#FFF',
          fontSize: 14,
          fontWeight: 800,
          textShadow: '0 1px 6px rgba(0,0,0,0.8)',
          margin: 0,
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        {label}
      </p>
    </div>
  );
}
