import { useTheme } from '../../theme/theme';
import { AppLogo, Card, EmptyState } from '../../ui/kit';

export function HistoricoScreen() {
  const { T } = useTheme();
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
        <p style={{ color: T.text, fontSize: 20, fontWeight: 800, margin: '12px 0 2px' }}>
          Histórico
        </p>
        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
          Seus gastos e economia ao longo do tempo
        </p>
      </div>
      <div style={{ padding: 16 }}>
        <Card>
          <EmptyState
            emoji="📊"
            titulo="Em breve"
            sub="Gráficos de gasto/economia por mês entram quando a persistência (Postgres) estiver ligada."
          />
        </Card>
      </div>
    </div>
  );
}
