import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { api, mensagemDeErro } from '../../api/client';

/**
 * Aviso NÃO-bloqueante (barra no topo, EM FLUXO — reserva o próprio espaço, então não
 * cobre o header/"+" da Home nem a onboarding de primeira abertura). Enquanto o e-mail
 * não foi confirmado, oferece reenviar o link. Some quando o /me traz emailVerificado:true
 * ou ao dispensar (nesta sessão). Verificação desligada (sem transporte de e-mail) → o
 * servidor devolve emailVerificado:true e a barra nem aparece.
 */
export function EmailVerificacaoBanner() {
  const { user } = useAuth();
  const { T } = useTheme();
  const [dispensado, setDispensado] = useState(false);
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'erro'>('idle');
  const [erro, setErro] = useState<string | null>(null);

  if (!user || user.emailVerificado || dispensado) return null;

  async function reenviar() {
    setEstado('enviando');
    setErro(null);
    try {
      await api.reenviarVerificacao();
      setEstado('enviado');
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEstado('erro');
    }
  }

  return (
    <div
      style={{
        flexShrink: 0,
        padding: 'max(6px, env(safe-area-inset-top)) 8px 6px',
        display: 'flex',
        justifyContent: 'center',
        background: T.bg,
      }}
    >
      <div
        style={{
          width: '100%',
          background: T.surface,
          border: `1px solid ${T.primary}55`,
          borderRadius: 12,
          padding: '9px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>✉️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: T.text, fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
            {estado === 'enviado' ? 'Link reenviado!' : 'Confirme seu e-mail'}
          </p>
          <p style={{ color: T.muted, fontSize: 11.5, margin: '1px 0 0', lineHeight: 1.35 }}>
            {estado === 'enviado'
              ? 'Confira sua caixa de entrada (e o spam).'
              : estado === 'erro'
                ? (erro ?? 'Não consegui reenviar agora.')
                : 'Enviamos um link pra confirmar sua conta.'}
          </p>
        </div>
        {estado !== 'enviado' && (
          <button
            onClick={() => void reenviar()}
            disabled={estado === 'enviando'}
            style={{
              flexShrink: 0,
              background: T.primaryBg,
              color: T.primary,
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: estado === 'enviando' ? 'default' : 'pointer',
            }}
          >
            {estado === 'enviando' ? '…' : 'Reenviar'}
          </button>
        )}
        <button
          onClick={() => setDispensado(true)}
          aria-label="Dispensar"
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            color: T.muted,
            fontSize: 16,
            cursor: 'pointer',
            padding: 2,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
