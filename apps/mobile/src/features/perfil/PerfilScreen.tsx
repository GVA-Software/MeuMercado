import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { AppLogo, Btn, Card, Pill, ThemeToggle } from '../../ui/kit';
import { AuthForm } from '../auth/AuthForm';

/**
 * Modal de recorte da foto: o usuário arrasta e dá zoom para enquadrar antes de
 * salvar (evita o corte automático cego). Gera um dataURL JPEG 256×256.
 */
function CropModal({
  file,
  onSave,
  onCancel,
}: {
  file: File;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const { T } = useTheme();
  const V = 280; // lado do visor (px)
  const [img, setImg] = useState<{ el: HTMLImageElement; w: number; h: number } | null>(null);
  const [src, setSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const image = new Image();
    image.onload = () => setImg({ el: image, w: image.naturalWidth, h: image.naturalHeight });
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = img ? Math.max(V / img.w, V / img.h) : 1;
  const effScale = baseScale * zoom;
  const dispW = img ? img.w * effScale : V;
  const dispH = img ? img.h * effScale : V;

  function clamp(x: number, y: number) {
    const maxX = Math.max(0, (dispW - V) / 2);
    const maxY = Math.max(0, (dispH - V) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }
  // Reajusta o pan quando o zoom muda para nunca deixar borda vazia.
  useEffect(() => {
    setOff((o) => clamp(o.x, o.y));
  }, [zoom, img]);

  const bgX = (V - dispW) / 2 + off.x;
  const bgY = (V - dispH) / 2 + off.y;

  function down(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    setOff(clamp(drag.current.ox + (e.clientX - drag.current.x), drag.current.oy + (e.clientY - drag.current.y)));
  }
  function up() {
    drag.current = null;
  }

  function salvar() {
    if (!img) return;
    const out = 256;
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img.el, -bgX / effScale, -bgY / effScale, V / effScale, V / effScale, 0, 0, out, out);
    onSave(canvas.toDataURL('image/jpeg', 0.85));
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 18,
      }}
    >
      <p style={{ color: '#FFF', fontSize: 16, fontWeight: 800, margin: 0 }}>Ajuste sua foto</p>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '-8px 0 0', textAlign: 'center' }}>
        Arraste para posicionar e use a barra para dar zoom.
      </p>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{
          width: V,
          height: V,
          maxWidth: '86vw',
          maxHeight: '86vw',
          borderRadius: 28,
          border: '3px solid rgba(255,255,255,0.9)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
          cursor: 'grab',
          touchAction: 'none',
          backgroundImage: src ? `url(${src})` : 'none',
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${dispW}px ${dispH}px`,
          backgroundPosition: `${bgX}px ${bgY}px`,
        }}
      />
      <input
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(e) => setZoom(parseFloat(e.target.value))}
        style={{ width: V, maxWidth: '86vw', accentColor: T.primary }}
      />
      <div style={{ display: 'flex', gap: 10, width: V, maxWidth: '86vw' }}>
        <Btn full variant="ghost" onClick={onCancel}>
          Cancelar
        </Btn>
        <Btn full onClick={salvar}>
          Usar foto
        </Btn>
      </div>
    </div>,
    document.body,
  );
}

export function PerfilScreen() {
  const { T } = useTheme();
  const { user, subscription, loading, atualizarNome, logout, cancelar } = useAuth();

  // Edição do nome.
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeEdit, setNomeEdit] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);

  function abrirEdicao() {
    setNomeEdit(user?.nome ?? '');
    setErroNome(null);
    setEditandoNome(true);
  }
  async function salvarNome() {
    const novo = nomeEdit.trim();
    if (novo.length < 1) return;
    if (novo === user?.nome) {
      setEditandoNome(false);
      return;
    }
    setSalvandoNome(true);
    setErroNome(null);
    try {
      await atualizarNome(novo);
      setEditandoNome(false);
    } catch (e) {
      setErroNome(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvandoNome(false);
    }
  }

  // Foto de perfil: fica só no aparelho (localStorage), privada do usuário.
  const fotoKey = user ? `mm-avatar:${user.email}` : '';
  const [foto, setFoto] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setFoto(fotoKey ? localStorage.getItem(fotoKey) : null);
  }, [fotoKey]);

  function onEscolherFoto(file?: File | null) {
    if (file) setCropFile(file);
    if (fileRef.current) fileRef.current.value = ''; // permite reescolher o mesmo arquivo
  }
  function salvarFoto(dataUrl: string) {
    if (fotoKey) {
      try {
        localStorage.setItem(fotoKey, dataUrl);
        setFoto(dataUrl);
      } catch {
        /* armazenamento cheio — ignora */
      }
    }
    setCropFile(null);
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
                <div style={{ minWidth: 0, flex: 1 }}>
                  {editandoNome ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                      <input
                        autoFocus
                        value={nomeEdit}
                        onChange={(e) => setNomeEdit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void salvarNome();
                          if (e.key === 'Escape') setEditandoNome(false);
                        }}
                        maxLength={120}
                        style={{
                          border: `1.5px solid ${T.primary}`,
                          borderRadius: 10,
                          padding: '8px 10px',
                          background: T.card,
                          color: T.text,
                          fontSize: 15,
                          fontWeight: 600,
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => void salvarNome()}
                          disabled={salvandoNome || nomeEdit.trim().length < 1}
                          style={{
                            background: T.primary,
                            color: '#FFF',
                            border: 'none',
                            borderRadius: 8,
                            padding: '6px 14px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            opacity: salvandoNome || nomeEdit.trim().length < 1 ? 0.5 : 1,
                          }}
                        >
                          {salvandoNome ? 'Salvando…' : 'Salvar'}
                        </button>
                        <button
                          onClick={() => setEditandoNome(false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: T.muted,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ color: T.text, fontSize: 16, fontWeight: 700, margin: 0 }}>
                        {user.nome}
                      </p>
                      <button
                        onClick={abrirEdicao}
                        aria-label="Editar nome"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: T.primary,
                          fontSize: 13,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  {erroNome && (
                    <p style={{ color: T.danger, fontSize: 12, margin: '2px 0 4px' }}>{erroNome}</p>
                  )}
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
                <p style={{ color: T.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  A Nina IA e os recursos Pro são liberados pela administração do Meu Mercado.
                </p>
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

      {cropFile && (
        <CropModal file={cropFile} onSave={salvarFoto} onCancel={() => setCropFile(null)} />
      )}
    </div>
  );
}
