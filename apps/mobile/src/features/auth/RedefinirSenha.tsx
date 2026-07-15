import { useState } from 'react';
import { useTheme } from '../../theme/theme';
import { api, mensagemDeErro } from '../../api/client';
import { AppLogo, Btn, Card } from '../../ui/kit';

/** Tela de nova senha, aberta pelo link do e-mail (`?reset=<token>`). */
export function RedefinirSenha({ token }: { token: string }) {
  const { T } = useTheme();
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function submit() {
    if (senha.length < 8) {
      setErro('A senha precisa de ao menos 8 caracteres.');
      return;
    }
    if (senha !== conf) {
      setErro('As senhas não conferem.');
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      await api.redefinirSenha(token, senha);
      setOk(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setBusy(false);
    }
  }

  function irParaLogin() {
    // Tira o token da URL e recarrega no fluxo normal (login).
    window.location.replace(window.location.pathname);
  }

  const input = {
    border: `1.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '13px 14px',
    background: T.card,
    color: T.text,
    fontSize: 15,
    width: '100%',
  } as const;

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
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <AppLogo size={20} />
          <p style={{ color: T.muted, fontSize: 13, margin: '10px 0 0' }}>Redefinir senha</p>
        </div>

        {ok ? (
          <>
            <p
              style={{
                color: T.text,
                textAlign: 'center',
                fontSize: 14,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              ✅ Senha alterada! Agora é só entrar com a nova senha.
            </p>
            <Btn full onClick={irParaLogin}>
              Ir para o login
            </Btn>
          </>
        ) : (
          <>
            <input
              type={ver ? 'text' : 'password'}
              placeholder="Nova senha (mín. 8 caracteres)"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={input}
            />
            <input
              type={ver ? 'text' : 'password'}
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              value={conf}
              onChange={(e) => setConf(e.target.value)}
              style={input}
            />
            <label
              style={{
                color: T.muted,
                fontSize: 12,
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />{' '}
              Mostrar senha
            </label>
            {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}
            <Btn full disabled={busy || !senha || !conf} onClick={() => void submit()}>
              {busy ? 'Salvando…' : 'Redefinir senha'}
            </Btn>
            <button
              onClick={irParaLogin}
              style={{
                background: 'none',
                border: 'none',
                color: T.primary,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Voltar ao login
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
