import { useTheme } from '../../theme/theme';
import { AppLogo, Card, EmptyState } from '../../ui/kit';

/**
 * Aba Mapa ("nosso Waze/Maps"). Placeholder honesto: a renderização com
 * MapLibre GL entra junto do módulo geo do back (mercados próximos + mais barato
 * + rota via Valhalla) e dos tiles PMTiles (OpenStreetMap). Sem Google Maps pago.
 */
export function MapaScreen() {
  const { T } = useTheme();
  const tilesUrl = import.meta.env.VITE_TILES_URL as string | undefined;

  return (
    <div style={{ paddingBottom: 100 }}>
      <div
        style={{
          background: T.surface,
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <AppLogo size={16} />
        <p style={{ color: T.text, fontSize: 20, fontWeight: 800, margin: '12px 0 2px' }}>Mapa</p>
        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
          Mercados perto de você e onde está mais barato
        </p>
      </div>
      <div style={{ padding: 16 }}>
        <Card>
          <EmptyState
            emoji="🗺️"
            titulo="Mapa em construção"
            sub={
              tilesUrl
                ? 'Tiles configurados — a renderização MapLibre entra no próximo milestone.'
                : 'Configure VITE_TILES_URL e suba o serviço de tiles (PMTiles/OSM) para ativar o mapa.'
            }
          />
        </Card>
      </div>
    </div>
  );
}
