import { useState } from 'react';
import { useTheme } from '../theme/theme';
import { BottomNav, type Tab } from '../components/BottomNav';
import { CompraScreen } from '../features/compra/CompraScreen';
import { NinaScreen } from '../features/nina/NinaScreen';
import { MapaScreen } from '../features/mapa/MapaScreen';
import { HistoricoScreen } from '../features/historico/HistoricoScreen';
import { PerfilScreen } from '../features/perfil/PerfilScreen';

export function App() {
  const { T } = useTheme();
  const [tab, setTab] = useState<Tab>('compra');

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text }}>
      {tab === 'compra' && <CompraScreen />}
      {tab === 'mapa' && <MapaScreen />}
      {tab === 'nina' && <NinaScreen />}
      {tab === 'historico' && <HistoricoScreen />}
      {tab === 'perfil' && <PerfilScreen />}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
