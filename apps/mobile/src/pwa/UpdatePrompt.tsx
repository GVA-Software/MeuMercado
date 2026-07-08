import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTheme } from '../theme/theme';

/**
 * Aparece quando há uma nova versão publicada (o Service Worker detecta o novo
 * build). O botão força a atualização — pula o "waiting" do SW e recarrega,
 * garantindo que o usuário sempre veja a versão mais recente.
 */
export function UpdatePrompt() {
  const { T } = useTheme();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Verifica se subiu versão nova a cada 60s (o botão aparece sozinho).
      if (registration) {
        window.setInterval(() => {
          void registration.update();
        }, 60_000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 90,
        transform: 'translateX(-50%)',
        zIndex: 600,
        width: 'calc(100% - 32px)',
        maxWidth: 398,
        background: T.primary,
        color: '#FFF',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
      }}
    >
      <span style={{ fontSize: 20 }}>✨</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Nova versão disponível</span>
      <button
        onClick={() => void updateServiceWorker(true)}
        style={{
          background: '#FFF',
          color: T.primary,
          border: 'none',
          borderRadius: 10,
          padding: '8px 16px',
          fontWeight: 800,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Atualizar
      </button>
    </div>
  );
}
