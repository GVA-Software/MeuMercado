import { lazy, Suspense, useCallback, useState } from 'react';
import { useTheme } from '../theme/theme';
import { useAuth } from '../auth/AuthContext';
import { NavProvider, type MapFocus } from './nav';
import { BottomNav, type Tab } from '../components/BottomNav';
import { CompraScreen } from '../features/compra/CompraScreen';
import { NinaScreen } from '../features/nina/NinaScreen';
import { PrecosScreen } from '../features/precos/PrecosScreen';
import { PerfilScreen } from '../features/perfil/PerfilScreen';
import { AuthScreen } from '../features/auth/AuthScreen';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { CartLoader } from '../ui/kit';

// Mapa em chunk separado (carrega o MapLibre só ao abrir a aba Mapa).
const MapaScreen = lazy(() =>
  import('../features/mapa/MapaScreen').then((m) => ({ default: m.MapaScreen })),
);

export function App() {
  const { T } = useTheme();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('compra');
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [precoFocus, setPrecoFocus] = useState<string | null>(null);

  const irParaMapa = useCallback((foco: MapFocus) => {
    setMapFocus(foco);
    setTab('mapa');
  }, []);

  const abrirRegistroPreco = useCallback((produtoId: string) => {
    setPrecoFocus(produtoId);
    setTab('historico');
  }, []);

  const consumirPrecoFocus = useCallback(() => setPrecoFocus(null), []);

  // Portão: precisa estar logado para usar o app.
  if (loading) {
    return (
      <div
        style={{
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: T.bg,
          color: T.muted,
        }}
      >
        <CartLoader label="Carregando…" />
      </div>
    );
  }
  if (!user) {
    return <AuthScreen />;
  }

  return (
    <NavProvider value={{ irParaMapa, abrirRegistroPreco }}>
      <div className="app-shell" style={{ background: T.bg, color: T.text }}>
        {/* Só esta área rola; o header (sticky) de cada tela e a nav ficam fixos. */}
        <div className="app-scroll" key={tab}>
          {tab === 'compra' && <CompraScreen />}
          {tab === 'mapa' && (
            <Suspense fallback={<CartLoader label="Carregando mapa…" center />}>
              <MapaScreen focus={mapFocus} />
            </Suspense>
          )}
          {tab === 'nina' && <NinaScreen />}
          {tab === 'historico' && (
            <PrecosScreen registrarProdutoId={precoFocus} onConsumeRegistro={consumirPrecoFocus} />
          )}
          {tab === 'perfil' && <PerfilScreen />}
        </div>
        <BottomNav
          tab={tab}
          setTab={(t) => {
            if (t !== 'mapa') setMapFocus(null);
            setTab(t);
          }}
        />
        <UpdatePrompt />
      </div>
    </NavProvider>
  );
}
