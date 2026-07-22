import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { AppLogo, AvisoDialog, Btn, Card, ConfirmDialog, Pill, ThemeToggle } from '../../ui/kit';
import { CreditoDev } from '../../ui/brand';
import { api, mensagemDeErro } from '../../api/client';
import { AuthForm } from '../auth/AuthForm';
import { PushToggle } from './PushToggle';
import { FeedbackCard } from './FeedbackCard';

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
    setOff(
      clamp(
        drag.current.ox + (e.clientX - drag.current.x),
        drag.current.oy + (e.clientY - drag.current.y),
      ),
    );
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
    ctx.drawImage(
      img.el,
      -bgX / effScale,
      -bgY / effScale,
      V / effScale,
      V / effScale,
      0,
      0,
      out,
      out,
    );
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
      <p
        style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: 13,
          margin: '-8px 0 0',
          textAlign: 'center',
        }}
      >
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

/**
 * Confirmação de exclusão de conta: exige a senha (ação destrutiva) e deixa claro que
 * os preços cadastrados FICAM na base comunitária. Ao excluir, desloga.
 */
function ExcluirContaModal({
  temSenha,
  onExcluido,
  onCancel,
}: {
  /** false = conta só-Google (sem senha) → não pede senha na confirmação. */
  temSenha: boolean;
  onExcluido: () => void;
  onCancel: () => void;
}) {
  const { T } = useTheme();
  const [senha, setSenha] = useState('');
  const [ciente, setCiente] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const podeExcluir = ciente && (!temSenha || !!senha);

  async function confirmar() {
    if (temSenha && !senha) {
      setErro('Digite sua senha para confirmar.');
      return;
    }
    if (!ciente) {
      setErro('Marque a caixa de ciência para confirmar.');
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      await api.excluirConta(temSenha ? senha : undefined);
      onExcluido();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setBusy(false);
    }
  }

  return createPortal(
    // Fundo desfocado; NÃO fecha ao clicar fora — só por "Cancelar" ou pela confirmação.
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100000,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p style={{ color: T.danger, fontWeight: 800, fontSize: 17, margin: 0 }}>
          ⚠️ Excluir minha conta
        </p>
        <p style={{ color: T.sub, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          Esta ação é <b>permanente</b> e não dá pra desfazer. Vamos <b>apagar</b> a sua conta e os
          seus dados pessoais (nome, e-mail, histórico de compras e notificações).
        </p>
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: '10px 12px',
          }}
        >
          <p style={{ color: T.sub, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            🛒 Os <b>preços</b> que você cadastrou <b>permanecem na base comunitária</b>, mas de
            forma <b>anônima</b> — sem qualquer vínculo com você. Preço é uma informação coletiva
            que ajuda todo mundo a economizar.
          </p>
        </div>
        <label
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            cursor: 'pointer',
            color: T.text,
            fontSize: 13.5,
            lineHeight: 1.45,
          }}
        >
          <input
            type="checkbox"
            checked={ciente}
            onChange={(e) => setCiente(e.target.checked)}
            style={{ marginTop: 2, width: 18, height: 18, accentColor: T.primary, flexShrink: 0 }}
          />
          <span>
            Estou ciente de que os preços que cadastrei <b>continuarão na base comunitária</b>, de
            forma anônima, e não serão apagados.
          </span>
        </label>
        {temSenha && (
          <input
            type="password"
            placeholder="Sua senha"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={{
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              padding: '13px 14px',
              background: T.card,
              color: T.text,
              fontSize: 15,
              width: '100%',
            }}
          />
        )}
        {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}
        <button
          onClick={() => void confirmar()}
          disabled={busy || !podeExcluir}
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: 12,
            border: 'none',
            background: T.danger,
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: busy || !podeExcluir ? 'not-allowed' : 'pointer',
            opacity: busy || !podeExcluir ? 0.6 : 1,
          }}
        >
          {busy ? 'Excluindo…' : 'Excluir minha conta'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            background: 'none',
            border: 'none',
            color: T.muted,
            fontSize: 14,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          Cancelar
        </button>
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

  // Cancelamento da assinatura (ação destrutiva → confirma + avisa).
  const [confirmarCancel, setConfirmarCancel] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelOk, setCancelOk] = useState(false);
  const [mostrarExcluir, setMostrarExcluir] = useState(false);

  // Portabilidade LGPD: baixa os próprios dados em JSON.
  const [baixando, setBaixando] = useState(false);
  const [erroBaixar, setErroBaixar] = useState<string | null>(null);

  async function baixarMeusDados() {
    setBaixando(true);
    setErroBaixar(null);
    try {
      const dados = await api.baixarMeusDados();
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados-meu-mercado.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErroBaixar(mensagemDeErro(e));
    } finally {
      setBaixando(false);
    }
  }

  async function fazerCancelamento() {
    setCancelando(true);
    try {
      await cancelar();
      setConfirmarCancel(false);
      setCancelOk(true);
    } catch {
      /* mantém o diálogo aberto; o estado do plano não muda */
    } finally {
      setCancelando(false);
    }
  }

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
      setErroNome(mensagemDeErro(e));
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
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 18,
                        objectFit: 'cover',
                        display: 'block',
                      }}
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
                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}
                    >
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
                  <Pill
                    color="#7C3AED"
                    bg="#7C3AED22"
                    label={`PRO · ${subscription.periodo ?? subscription.status}`}
                  />
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
                  <Btn variant="ghost" small onClick={() => setConfirmarCancel(true)}>
                    Cancelar assinatura
                  </Btn>
                </>
              ) : (
                <p style={{ color: T.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  A Nina IA e os recursos Pro são liberados pela administração do Meu Mercado.
                </p>
              )}
            </Card>

            <PushToggle />

            <FeedbackCard />

            <Btn variant="ghost" full onClick={() => void logout()}>
              Sair
            </Btn>

            <Btn variant="ghost" full disabled={baixando} onClick={() => void baixarMeusDados()}>
              {baixando ? 'Preparando…' : '⬇️ Baixar meus dados'}
            </Btn>
            {erroBaixar && (
              <p style={{ color: T.danger, fontSize: 12, textAlign: 'center', margin: 0 }}>
                {erroBaixar}
              </p>
            )}

            <Btn variant="ghost" full onClick={() => setMostrarExcluir(true)}>
              Excluir minha conta
            </Btn>

            <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: 12, color: T.muted }}>
              <a href="/privacidade.html" style={{ color: T.muted }}>
                Política de Privacidade
              </a>{' '}
              ·{' '}
              <a href="/termos.html" style={{ color: T.muted }}>
                Termos de Uso
              </a>
            </p>
            <CreditoDev style={{ margin: '2px 0 0' }} />
          </>
        )}
      </div>

      {mostrarExcluir && (
        <ExcluirContaModal
          temSenha={!!user?.temSenha}
          onExcluido={() => void logout()}
          onCancel={() => setMostrarExcluir(false)}
        />
      )}

      {cropFile && (
        <CropModal file={cropFile} onSave={salvarFoto} onCancel={() => setCropFile(null)} />
      )}

      {confirmarCancel && (
        <ConfirmDialog
          emoji="💔"
          titulo="Cancelar o Pro?"
          mensagem="Você perde a Nina IA e os recursos Pro. Dá pra voltar depois pela administração."
          confirmarLabel="Cancelar assinatura"
          cancelarLabel="Manter Pro"
          perigo
          ocupado={cancelando}
          onConfirmar={() => void fazerCancelamento()}
          onCancelar={() => setConfirmarCancel(false)}
        />
      )}
      {cancelOk && (
        <AvisoDialog
          emoji="✅"
          titulo="Assinatura cancelada"
          mensagem="Seu plano voltou para o Free."
          onOk={() => setCancelOk(false)}
        />
      )}
    </div>
  );
}
