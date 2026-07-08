import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PLANOS, type Periodo } from '@meumercado/contracts';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { Btn } from '../../ui/kit';

const BENEFICIOS = [
  '📋 QR de nota fiscal ilimitado',
  '📊 Histórico completo',
  '✨ Nina IA com insights reais',
  '🟢 Indicador acima/abaixo da média',
  '💰 Economia acumulada total',
];

/** Modal de assinatura do Pro. Em produção, o "assinar" passa pelo gateway. */
export function Paywall({ onClose }: { onClose: () => void }) {
  const { T } = useTheme();
  const { assinar } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>('anual');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setBusy(true);
    setErro(null);
    try {
      await assinar(periodo);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: T.surface,
          borderRadius: '28px 28px 0 0',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#C026D3)',
            padding: '28px 24px',
            textAlign: 'center',
            borderRadius: '28px 28px 0 0',
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 8 }}>🌟</div>
          <p style={{ color: '#FFF', fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>
            Meu Mercado Pro
          </p>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: 0 }}>
            Desbloqueie tudo, incluindo a Nina IA.
          </p>
        </div>

        <div style={{ padding: '22px 20px calc(40px + env(safe-area-inset-bottom))' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {(['mensal', 'anual'] as Periodo[]).map((p) => {
              const ativo = periodo === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    padding: '16px 12px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    border: `2px solid ${ativo ? '#7C3AED' : T.border}`,
                    background: ativo ? '#7C3AED18' : T.card,
                    position: 'relative',
                  }}
                >
                  {p === 'anual' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(135deg,#7C3AED,#C026D3)',
                        color: '#FFF',
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: 99,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ECONOMIZE 33%
                    </div>
                  )}
                  <p
                    style={{
                      color: ativo ? '#7C3AED' : T.text,
                      fontSize: 13,
                      fontWeight: 700,
                      margin: '0 0 4px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {p}
                  </p>
                  <p
                    style={{
                      color: ativo ? '#7C3AED' : T.text,
                      fontSize: 20,
                      fontWeight: 800,
                      margin: 0,
                    }}
                  >
                    {PLANOS[p].label}
                  </p>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {BENEFICIOS.map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: T.green, fontSize: 16 }}>✓</span>
                <span style={{ color: T.text, fontSize: 14 }}>{b}</span>
              </div>
            ))}
          </div>

          {erro && <p style={{ color: T.danger, fontSize: 13, margin: '0 0 12px' }}>{erro}</p>}

          <Btn full disabled={busy} onClick={() => void confirmar()}>
            {busy ? 'Processando…' : `Assinar ${PLANOS[periodo].label}`}
          </Btn>
          <p style={{ color: T.muted, fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
            7 dias grátis. Cancele quando quiser.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
