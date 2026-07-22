import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../theme/theme';
import { api, mensagemDeErro } from '../../api/client';
import { AppLogo, Btn, Card } from '../../ui/kit';

/**
 * Tela aberta pelo link do e-mail (`?verificar-email=<token>`): confirma o e-mail
 * automaticamente ao abrir e mostra o resultado. Não precisa de sessão (o token é a prova).
 */
export function ConfirmarEmail({ token }: { token: string }) {
  const { T } = useTheme();
  const [estado, setEstado] = useState<'confirmando' | 'ok' | 'erro'>('confirmando');
  const [erro, setErro] = useState<string | null>(null);
  const feitoRef = useRef(false);

  useEffect(() => {
    if (feitoRef.current) return; // StrictMode/dev: confirma só uma vez
    feitoRef.current = true;
    api
      .confirmarEmail(token)
      .then(() => setEstado('ok'))
      .catch((e: unknown) => {
        setErro(mensagemDeErro(e));
        setEstado('erro');
      });
  }, [token]);

  function irParaApp() {
    // Tira o token da URL e recarrega no fluxo normal.
    window.location.replace(window.location.pathname);
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
        <div style={{ marginBottom: 4 }}>
          <AppLogo size={20} />
        </div>

        {estado === 'confirmando' && (
          <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Confirmando seu e-mail…</p>
        )}

        {estado === 'ok' && (
          <>
            <p style={{ color: T.text, fontSize: 15, lineHeight: 1.5, margin: 0 }}>
              ✅ E-mail confirmado! Sua conta está completa.
            </p>
            <Btn full onClick={irParaApp}>
              Ir para o app
            </Btn>
          </>
        )}

        {estado === 'erro' && (
          <>
            <p style={{ color: T.text, fontSize: 15, lineHeight: 1.5, margin: 0 }}>
              {erro ?? 'Link inválido ou expirado.'}
            </p>
            <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
              Entre no app e toque em “Reenviar” no aviso de confirmação para receber um novo link.
            </p>
            <Btn full onClick={irParaApp}>
              Ir para o app
            </Btn>
          </>
        )}
      </Card>
    </div>
  );
}
