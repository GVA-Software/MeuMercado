import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { AppLogo, Btn, Card, Pill, ThemeToggle } from '../../ui/kit';
import { AuthForm } from '../auth/AuthForm';
import { Paywall } from '../billing/Paywall';

/** Redimensiona/recorta a imagem num quadrado de 256px e devolve como dataURL JPEG. */
function fotoQuadrada(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      const escala = Math.max(size / img.width, size / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

export function PerfilScreen() {
  const { T } = useTheme();
  const { user, subscription, loading, logout, cancelar } = useAuth();
  const [paywall, setPaywall] = useState(false);

  // Foto de perfil: fica só no aparelho (localStorage), privada do usuário.
  const fotoKey = user ? `mm-avatar:${user.email}` : '';
  const [foto, setFoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setFoto(fotoKey ? localStorage.getItem(fotoKey) : null);
  }, [fotoKey]);

  async function onEscolherFoto(file?: File | null) {
    if (!file || !fotoKey) return;
    const data = await fotoQuadrada(file);
    if (!data) return;
    try {
      localStorage.setItem(fotoKey, data);
      setFoto(data);
    } catch {
      /* armazenamento cheio — ignora */
    }
  }
  function removerFoto() {
    if (fotoKey) localStorage.removeItem(fotoKey);
    setFoto(null);
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
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
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <button
                  onClick={() => fileRef.current?.click()}
                  aria-label="Alterar foto de perfil"
                  style={{
                    position: 'relative',
                    width: 60,
                    height: 60,
                    borderRadius: 18,
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    background: foto ? 'transparent' : T.primaryBg,
                    flexShrink: 0,
                  }}
                >
                  {foto ? (
                    <img
                      src={foto}
                      alt=""
                      width={60}
                      height={60}
                      style={{ width: 60, height: 60, borderRadius: 18, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'flex',
                        width: 60,
                        height: 60,
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28,
                      }}
                    >
                      👤
                    </span>
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      right: -4,
                      bottom: -4,
                      width: 24,
                      height: 24,
                      borderRadius: 99,
                      background: T.primary,
                      color: '#FFF',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px solid ${T.surface}`,
                    }}
                  >
                    📷
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onEscolherFoto(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: T.text, fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {user.nome}
                  </p>
                  <p style={{ color: T.muted, fontSize: 13, margin: '2px 0 6px' }}>{user.email}</p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      onClick={() => fileRef.current?.click()}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: T.primary,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {foto ? 'Trocar foto' : '📷 Adicionar foto'}
                    </button>
                    {foto && (
                      <button
                        onClick={removerFoto}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: T.muted,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <p style={{ color: T.muted, fontSize: 11, margin: '6px 0 0' }}>
                    🔒 Fica só neste aparelho
                  </p>
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
