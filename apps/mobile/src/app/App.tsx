import { lazy, Suspense, useState } from 'react';
import { useTheme } from '../theme/theme';
import { BottomNav, type Tab } from '../components/BottomNav';
import { CompraScreen } from '../features/compra/CompraScreen';
import { NinaScreen } from '../features/nina/NinaScreen';
import { HistoricoScreen } from '../features/historico/HistoricoScreen';
import { PerfilScreen } from '../features/perfil/PerfilScreen';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

// Mapa em chunk separado (carrega o MapLibre só ao abrir a aba Mapa).
const MapaScreen = lazy(() =>
  import('../features/mapa/MapaScreen').then((m) => ({ default: m.MapaScreen })),
);

export function App() {
  const { T } = useTheme();
  const [tab, setTab] = useState<Tab>('compra');

  return (
    <div className="app-shell" style={{ background: T.bg, color: T.text }}>
      {/* Só esta área rola; o header (sticky) de cada tela e a nav ficam fixos. */}
      <div className="app-scroll" key={tab}>
        {tab === 'compra' && <CompraScreen />}
        {tab === 'mapa' && (
          <Suspense fallback={<p style={{ padding: 20, color: T.muted }}>Carregando mapa…</p>}>
            <MapaScreen />
          </Suspense>
        )}
        {tab === 'nina' && <NinaScreen />}
        {tab === 'historico' && <HistoricoScreen />}
        {tab === 'perfil' && <PerfilScreen />}
      </div>
      <BottomNav tab={tab} setTab={setTab} />
      <UpdatePrompt />
    </div>
  );
}
