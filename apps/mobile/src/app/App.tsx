import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTheme } from '../theme/theme';
import { useAuth } from '../auth/AuthContext';
import { NavProvider, type MapFocus } from './nav';
import { BottomNav, type Tab } from '../components/BottomNav';
import { CompraScreen } from '../features/compra/CompraScreen';
import { NinaScreen } from '../features/nina/NinaScreen';
import { PrecosScreen } from '../features/precos/PrecosScreen';
import { PerfilScreen } from '../features/perfil/PerfilScreen';
import { AuthScreen } from '../features/auth/AuthScreen';
import { Onboarding } from '../features/onboarding/Onboarding';
import { onboardingVisto, marcarOnboardingVisto } from '../features/onboarding/onboardingStore';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { CartLoader, ScrollTopFab } from '../ui/kit';

// Mapa em chunk separado (carrega o MapLibre só ao abrir a aba Mapa).
const MapaScreen = lazy(() =>
  import('../features/mapa/MapaScreen').then((m) => ({ default: m.MapaScreen })),
);

export function App() {
  const { T } = useTheme();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('compra');
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [precoReq, setPrecoReq] = useState<{ produtoId?: string } | null>(null);
  const [onboarding, setOnboarding] = useState(false);

  const irParaMapa = useCallback((foco: MapFocus) => {
    setMapFocus(foco);
    setTab('mapa');
  }, []);

  const abrirRegistroPreco = useCallback((produtoId?: string) => {
    setPrecoReq(produtoId ? { produtoId } : {});
    setTab('historico');
  }, []);

  const consumirPrecoReq = useCallback(() => setPrecoReq(null), []);

  // Boas-vindas de primeira abertura (só depois de logado, uma vez por aparelho).
  useEffect(() => {
    if (user && !onboardingVisto()) setOnboarding(true);
  }, [user]);

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
            <PrecosScreen registrarReq={precoReq} onConsumeRegistro={consumirPrecoReq} />
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
        {/* NÃO usar key={tab} aqui: o `.app-scroll` acima já usa key={tab}, e dois
            irmãos com a MESMA key quebram a reconciliação do React no WebKit (Safari/
            iOS) — as telas empilhavam em vez de trocar. A aba vem por prop. */}
        <ScrollTopFab tab={tab} />
        <UpdatePrompt />
      </div>
      {onboarding && (
        <Onboarding
          onRegistrar={() => {
            marcarOnboardingVisto();
            setOnboarding(false);
            abrirRegistroPreco();
          }}
          onExplorar={() => {
            marcarOnboardingVisto();
            setOnboarding(false);
            setTab('historico');
          }}
          onFechar={() => {
            marcarOnboardingVisto();
            setOnboarding(false);
          }}
        />
      )}
    </NavProvider>
  );
}
