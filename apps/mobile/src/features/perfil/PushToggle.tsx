import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { Card } from '../../ui/kit';

/** Converte a chave VAPID (base64url) no formato aceito pelo PushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Liga/desliga as notificações push do usuário (Web Push). */
export function PushToggle() {
  const { T } = useTheme();
  const suportado =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [ativo, setAtivo] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!suportado) {
      setPronto(true);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setAtivo(!!sub))
      .catch(() => {})
      .finally(() => setPronto(true));
  }, [suportado]);

  async function ativar() {
    setBusy(true);
    setErro(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setErro('Permissão de notificações negada. Ative nas configurações do navegador.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await api.pushPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.pushSubscribe(sub.toJSON());
      setAtivo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function desativar() {
    setBusy(true);
    setErro(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.pushUnsubscribe(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setAtivo(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🔔</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: T.text, fontWeight: 700, margin: 0 }}>Notificações</p>
          <p style={{ color: T.muted, fontSize: 12, margin: '2px 0 0', lineHeight: 1.4 }}>
            Receba avisos e novidades do Meu Mercado.
          </p>
        </div>
        {suportado && (
          <button
            onClick={() => void (ativo ? desativar() : ativar())}
            disabled={busy || !pronto}
            aria-label={ativo ? 'Desativar notificações' : 'Ativar notificações'}
            style={{
              flexShrink: 0,
              width: 48,
              height: 28,
              borderRadius: 99,
              border: 'none',
              cursor: busy || !pronto ? 'wait' : 'pointer',
              background: ativo ? T.primary : T.border,
              position: 'relative',
              transition: 'background 0.2s',
              opacity: busy || !pronto ? 0.6 : 1,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: ativo ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: 99,
                background: '#FFF',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </button>
        )}
      </div>

      {!suportado && (
        <p style={{ color: T.muted, fontSize: 12, margin: '10px 0 0', lineHeight: 1.5 }}>
          📱 No iPhone, adicione o app à <strong>Tela de Início</strong> (compartilhar → “Adicionar
          à Tela de Início”) para poder ativar as notificações.
        </p>
      )}
      {erro && <p style={{ color: T.danger, fontSize: 12, margin: '8px 0 0' }}>{erro}</p>}
    </Card>
  );
}
