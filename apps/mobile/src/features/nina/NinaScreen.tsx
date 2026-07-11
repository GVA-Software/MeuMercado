import { PLANOS, type Periodo } from '@meumercado/contracts';
import { useAuth } from '../../auth/AuthContext';
import { useTheme, type Theme } from '../../theme/theme';
import { CartLoader } from '../../ui/kit';
import { NinaChat } from './NinaChat';

const BENEFICIOS = [
  '✨ Insights automáticos dos seus preços',
  '📉 Alertas de alta e queda',
  '🏷️ Onde cada item está mais barato',
  '🛒 Melhor combinação de mercados pra sua cesta',
  '📊 Histórico e economia acumulada',
];

// Folga para a BottomNav (fixa) — o composer do chat fica confortavelmente acima.
const NAV_H = 98;

export function NinaScreen() {
  const { T } = useTheme();
  const { subscription } = useAuth();
  const isPro = subscription?.isPro ?? false;

  // Pro: a Nina é um bate-papo em tela cheia (estilo WhatsApp).
  if (subscription !== null && isPro) {
    return (
      <div
        style={{
          height: '100%',
          boxSizing: 'border-box',
          paddingBottom: NAV_H,
          display: 'flex',
          flexDirection: 'column',
          background: T.bg,
        }}
      >
        <NinaHeader T={T} />
        <NinaChat T={T} />
      </div>
    );
  }

  // Free / carregando: página normal com rolagem.
  return (
    <div style={{ paddingBottom: 100 }}>
      <NinaHeader T={T} sticky />
      {subscription === null ? (
        <div style={{ padding: 16 }}>
          <CartLoader label="Carregando…" />
        </div>
      ) : (
        <NinaBloqueada T={T} />
      )}
    </div>
  );
}

/** Barra do topo da Nina (o "cabeçalho do chat"). */
function NinaHeader({ T, sticky }: { T: Theme; sticky?: boolean }) {
  return (
    <div
      style={{
        ...(sticky ? { position: 'sticky', top: 0, zIndex: 50 } : {}),
        flexShrink: 0,
        background: T.ninaGrad,
        padding: '20px 20px',
        borderRadius: '0 0 24px 24px',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 15,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
          }}
        >
          ✨
        </div>
        <div>
          <p style={{ color: '#FFF', fontSize: 21, fontWeight: 800, margin: 0 }}>Nina IA</p>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: 0 }}>
            Sua assistente de compras
          </p>
        </div>
      </div>
    </div>
  );
}

/** Nina bloqueada (Free): tela de desbloqueio com benefícios e preços. */
function NinaBloqueada({ T }: { T: Theme }) {
  return (
    <div style={{ padding: '20px 16px' }}>
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: '24px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }}>🔒</div>
        <p style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>
          A Nina IA é um recurso Pro
        </p>
        <p style={{ color: T.muted, fontSize: 13, margin: '0 0 18px', lineHeight: 1.5 }}>
          Assine para desbloquear os insights inteligentes dos seus preços.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            textAlign: 'left',
            marginBottom: 20,
          }}
        >
          {BENEFICIOS.map((b) => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: T.green, fontSize: 15 }}>✓</span>
              <span style={{ color: T.text, fontSize: 14 }}>{b}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {(['mensal', 'anual'] as Periodo[]).map((p) => (
            <div
              key={p}
              style={{
                flex: 1,
                border: `1.5px solid ${p === 'anual' ? T.nina : T.border}`,
                background: p === 'anual' ? `${T.nina}14` : T.card,
                borderRadius: 16,
                padding: '14px 10px',
              }}
            >
              <p
                style={{
                  color: T.muted,
                  fontSize: 12,
                  fontWeight: 700,
                  margin: '0 0 4px',
                  textTransform: 'capitalize',
                }}
              >
                {p}
                {p === 'anual' ? ' · melhor valor' : ''}
              </p>
              <p style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: 0 }}>
                {PLANOS[p].label}
              </p>
            </div>
          ))}
        </div>

        <p style={{ color: T.muted, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          🛠️ A ativação é feita pela administração do Meu Mercado. Fale com a gente para liberar o
          seu Pro.
        </p>
      </div>
    </div>
  );
}
