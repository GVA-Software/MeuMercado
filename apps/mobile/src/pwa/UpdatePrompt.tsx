import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTheme } from '../theme/theme';
import { Btn } from '../ui/kit';

/**
 * Aparece quando há uma nova versão publicada (o Service Worker detecta o novo
 * build). É um modal CENTRAL e BLOQUEANTE: cobre o app e não dá pra sair sem
 * atualizar — garante que ninguém fica numa versão antiga (dados/comportamento
 * defasados).
 */
export function UpdatePrompt() {
  const { T } = useTheme();
  const [atualizando, setAtualizando] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const checar = () => void registration.update();
      // Verifica se subiu versão nova a cada 60s enquanto o app está aberto…
      window.setInterval(checar, 60_000);
      // …e SEMPRE que o app volta ao primeiro plano. Crucial no iOS instalado:
      // o timer pausa em segundo plano, então sem isto a versão nova nunca
      // chegava a quem fechava e reabria o app (ficava preso na versão antiga).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checar();
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 22,
          padding: '30px 24px',
          width: '100%',
          maxWidth: 340,
          textAlign: 'center',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
        }}
      >
        <img
          src="/Loading.png"
          alt=""
          width={72}
          height={72}
          style={{
            objectFit: 'contain',
            ...(atualizando ? { animation: 'mm-logo-bob 1s ease-in-out infinite' } : {}),
          }}
        />
        <h2 style={{ color: T.text, fontSize: 20, fontWeight: 800, margin: '16px 0 6px' }}>
          {atualizando ? 'Atualizando…' : 'Nova versão disponível 🎉'}
        </h2>
        <p style={{ color: T.muted, fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
          {atualizando
            ? 'Só um instante — já vamos abrir a versão nova.'
            : 'Atualize para continuar com a melhor experiência e os dados mais recentes.'}
        </p>
        <Btn
          full
          disabled={atualizando}
          onClick={() => {
            setAtualizando(true);
            void updateServiceWorker(true);
            // Rede de segurança: no iOS o reload automático do SW às vezes não
            // dispara. Se em ~3,5s nada aconteceu, força o reload — ninguém fica
            // preso no "Atualizando…".
            window.setTimeout(() => window.location.reload(), 3500);
          }}
        >
          {atualizando ? 'Aguarde…' : 'Atualizar agora'}
        </Btn>
      </div>
    </div>
  );
}
