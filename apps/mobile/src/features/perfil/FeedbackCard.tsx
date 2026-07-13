import { useState } from 'react';
import type { FeedbackTipo } from '@meumercado/contracts';
import { api, mensagemDeErro } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { AvisoDialog, Btn, Card } from '../../ui/kit';

const TIPOS: Array<{ v: FeedbackTipo; label: string }> = [
  { v: 'bug', label: '🐛 Bug' },
  { v: 'sugestao', label: '💡 Sugestão' },
  { v: 'elogio', label: '❤️ Elogio' },
  { v: 'outro', label: '💬 Outro' },
];

/** Card do Perfil: manda feedback (bug/sugestão/elogio). O ADM responde e volta por push. */
export function FeedbackCard() {
  const { T } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<FeedbackTipo>('sugestao');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.enviarFeedback(tipo, msg.trim());
      setMsg('');
      setAberto(false);
      setOk(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <>
        <button
          onClick={() => setAberto(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '14px 16px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 18 }}>💬</span>
          <span style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: 700 }}>
            Enviar feedback
          </span>
          <span style={{ color: T.muted, fontSize: 13 }}>bug · ideia · elogio ›</span>
        </button>
        {ok && (
          <AvisoDialog
            emoji="🧡"
            titulo="Feedback enviado!"
            mensagem="Obrigado! Se precisar, a gente responde por notificação (e e-mail)."
            onOk={() => setOk(false)}
          />
        )}
      </>
    );
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ color: T.text, fontSize: 15 }}>Enviar feedback</strong>
        <button
          onClick={() => setAberto(false)}
          style={{
            background: 'none',
            border: 'none',
            color: T.muted,
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TIPOS.map((t) => {
          const sel = tipo === t.v;
          return (
            <button
              key={t.v}
              onClick={() => setTipo(t.v)}
              style={{
                background: sel ? T.primaryBg : T.card,
                color: sel ? T.primary : T.sub,
                border: `1px solid ${sel ? T.primary : T.border}`,
                borderRadius: 99,
                padding: '7px 13px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Conte pra gente: um bug que encontrou, uma ideia, um elogio…"
        rows={4}
        maxLength={2000}
        style={{
          border: `1.5px solid ${T.border}`,
          borderRadius: 12,
          padding: '11px 14px',
          background: T.card,
          color: T.text,
          fontSize: 14,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}
      <Btn full disabled={enviando || msg.trim().length < 3} onClick={() => void enviar()}>
        {enviando ? 'Enviando…' : 'Enviar'}
      </Btn>
    </Card>
  );
}
