import { useTheme } from '../theme/theme';

export type Tab = 'compra' | 'mapa' | 'nina' | 'historico' | 'perfil';

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'compra', icon: '🛒', label: 'Compra' },
  { id: 'mapa', icon: '📍', label: 'Mapa' },
  { id: 'nina', icon: '✨', label: 'Nina IA' },
  { id: 'historico', icon: '📊', label: 'Histórico' },
  { id: 'perfil', icon: '👤', label: 'Perfil' },
];

export function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { T } = useTheme();
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        background: T.navBg,
        borderTop: `1px solid ${T.border}`,
        boxShadow: `0 -4px 20px ${T.shadow}`,
        display: 'flex',
        padding: '8px 0 20px',
        zIndex: 100,
      }}
    >
      {TABS.map((t) => {
        const active = tab === t.id;
        const accentBg = t.id === 'nina' ? T.ninaBg : T.primaryBg;
        const accent = t.id === 'nina' ? T.nina : T.primary;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '6px 0',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: active ? accentBg : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 20 }}>{t.icon}</span>
            </div>
            <span
              style={{
                fontSize: 10,
                color: active ? accent : T.muted,
                fontWeight: active ? 700 : 500,
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
