import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { AppLogo, Btn, Card, Pill, ThemeToggle } from '../../ui/kit';
import { AuthForm } from '../auth/AuthForm';
import { Paywall } from '../billing/Paywall';

export function PerfilScreen() {
  const { T } = useTheme();
  const { user, subscription, loading, logout, cancelar } = useAuth();
  const [paywall, setPaywall] = useState(false);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div
        style={{
          background: T.surface,
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppLogo size={16} />
          <ThemeToggle />
        </div>
        <p style={{ color: T.text, fontSize: 20, fontWeight: 800, margin: '12px 0 2px' }}>Perfil</p>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <p style={{ color: T.muted }}>Carregando…</p>
        ) : !user ? (
          <AuthForm />
        ) : (
          <>
            <Card>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: T.primaryBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                  }}
                >
                  👤
                </div>
                <div>
                  <p style={{ color: T.text, fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {user.nome}
                  </p>
                  <p style={{ color: T.muted, fontSize: 13, margin: '2px 0 0' }}>{user.email}</p>
                </div>
              </div>
            </Card>

            <Card color={subscription?.isPro ? `${'#7C3AED'}55` : T.border}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <p style={{ color: T.text, fontWeight: 700, margin: 0 }}>Plano</p>
                {subscription?.isPro ? (
                  <Pill color="#7C3AED" bg="#7C3AED22" label={`PRO · ${subscription.status}`} />
                ) : (
                  <Pill color={T.muted} bg={T.card} label="FREE" />
                )}
              </div>
              {subscription?.isPro ? (
                <>
                  <p style={{ color: T.muted, fontSize: 13, margin: '0 0 12px' }}>
                    {subscription.diasRestantes} dias restantes
                    {subscription.periodo ? ` · ${subscription.periodo}` : ''}
                  </p>
                  <Btn variant="ghost" small onClick={() => void cancelar()}>
                    Cancelar assinatura
                  </Btn>
                </>
              ) : (
                <>
                  <p style={{ color: T.muted, fontSize: 13, margin: '0 0 12px' }}>
                    Desbloqueie a Nina IA, histórico completo e mais.
                  </p>
                  <Btn full onClick={() => setPaywall(true)}>
                    ✨ Assinar o Pro
                  </Btn>
                </>
              )}
            </Card>

            <Card>
              <p style={{ color: T.text, fontWeight: 700, margin: '0 0 8px' }}>Aparência</p>
              <ThemeToggle />
            </Card>

            <Btn variant="ghost" full onClick={() => void logout()}>
              Sair
            </Btn>
          </>
        )}
      </div>

      {paywall && <Paywall onClose={() => setPaywall(false)} />}
    </div>
  );
}
