import { createPortal } from 'react-dom';
import { useState } from 'react';
import { POLITICA_VERSAO } from '@meumercado/contracts';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { mensagemDeErro } from '../../api/client';

/**
 * Reaceite obrigatório: quando a Política/Termos muda de versão, quem aceitou uma
 * versão antiga (ou nunca aceitou) precisa revisar e aceitar de novo para continuar.
 * Bloqueia o app até aceitar ou sair. Trilha de consentimento LGPD sempre atual.
 */
export function ReconsentGate() {
  const { user, aceitarPolitica, logout } = useAuth();
  const { T } = useTheme();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só quando logado E a versão aceita difere da vigente (null também dispara).
  if (!user || user.politicaVersao === POLITICA_VERSAO) return null;

  async function aceitar() {
    setBusy(true);
    setErro(null);
    try {
      await aceitarPolitica();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setBusy(false);
    }
  }

  const link = { color: T.primary, fontWeight: 700 };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
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
          maxWidth: 400,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <p style={{ color: T.text, fontWeight: 800, fontSize: 18, margin: 0 }}>
          📄 Atualizamos nossos termos
        </p>
        <p style={{ color: T.sub, fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>
          Melhoramos a nossa{' '}
          <a href="/privacidade.html" style={link}>
            Política de Privacidade
          </a>{' '}
          e os{' '}
          <a href="/termos.html" style={link}>
            Termos de Uso
          </a>{' '}
          (por exemplo: como funciona a exclusão de conta e um canal para corrigir preços). Para
          continuar, revise e aceite.
        </p>
        {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}
        <button
          onClick={() => void aceitar()}
          disabled={busy}
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: 12,
            border: 'none',
            background: T.primary,
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Salvando…' : 'Aceitar e continuar'}
        </button>
        <button
          onClick={() => void logout()}
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
          Sair
        </button>
      </div>
    </div>,
    document.body,
  );
}
