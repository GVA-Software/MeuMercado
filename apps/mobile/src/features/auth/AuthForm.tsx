import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { api, mensagemDeErro } from '../../api/client';
import { AppLogo, Btn, Card } from '../../ui/kit';
import { CreditoDev } from '../../ui/brand';

type Mode = 'login' | 'register' | 'forgot';

/** "G" oficial do Google (4 cores) — recognizível sobre o botão laranja translúcido. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Formulário de login/cadastro + recuperação de senha (mostrado quando deslogado). */
export function AuthForm() {
  const { T } = useTheme();
  const { login, register, loginComGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [aceito, setAceito] = useState(false); // consentimento LGPD (obrigatório no cadastro)

  // Login com Google (apagado por padrão — só acende com VITE_GOOGLE_CLIENT_ID).
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const googleBtnRef = useRef<HTMLDivElement>(null); // botão real do GIS (invisível)
  const googleWrapRef = useRef<HTMLDivElement>(null); // container p/ medir a largura
  // Refs para o callback do GIS (fixado uma vez) ler o valor ATUAL de aceite/modo.
  const aceitoRef = useRef(aceito);
  aceitoRef.current = aceito;
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const clientId = googleClientId ?? '';
    if (!clientId || mode === 'forgot') return;
    let cancelado = false;

    async function entrar(credential: string) {
      // No cadastro exige o aceite explícito; no login, conta nova cai no ReconsentGate.
      if (modeRef.current === 'register' && !aceitoRef.current) {
        setErro('Aceite os Termos para entrar com o Google.');
        return;
      }
      setBusy(true);
      setErro(null);
      try {
        await loginComGoogle(credential, aceitoRef.current);
      } catch (e) {
        setErro(mensagemDeErro(e));
      } finally {
        setBusy(false);
      }
    }

    function iniciar() {
      const gid = window.google?.accounts?.id;
      if (cancelado || !gid || !googleBtnRef.current) return;
      gid.initialize({
        client_id: clientId,
        callback: (resp) => {
          if (resp.credential) void entrar(resp.credential);
        },
        cancel_on_tap_outside: true,
      });
      googleBtnRef.current.innerHTML = '';
      // Renderiza o botão real do Google na LARGURA do container: ele fica invisível
      // (opacity 0) por cima do nosso botão estilizado e é ele que captura o toque —
      // assim mantemos o fluxo oficial (ID token) com a nossa aparência.
      const largura = Math.max(200, Math.min(400, googleWrapRef.current?.clientWidth ?? 320));
      gid.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: mode === 'register' ? 'signup_with' : 'signin_with',
        shape: 'pill',
        logo_alignment: 'center',
        width: largura,
      });
    }

    const SRC = 'https://accounts.google.com/gsi/client';
    if (window.google?.accounts?.id) {
      iniciar();
    } else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
      if (!s) {
        s = document.createElement('script');
        s.src = SRC;
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
      s.addEventListener('load', iniciar, { once: true });
    }
    return () => {
      cancelado = true;
    };
  }, [googleClientId, mode, loginComGoogle]);

  async function submit() {
    setBusy(true);
    setErro(null);
    try {
      if (mode === 'forgot') {
        await api.esqueciSenha(email);
        setEnviado(true);
      } else if (mode === 'login') {
        await login(email, senha);
      } else {
        await register(email, nome, senha);
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setBusy(false);
    }
  }

  function trocarModo(m: Mode) {
    setMode(m);
    setErro(null);
    setEnviado(false);
    setAceito(false);
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
  const link = {
    background: 'none',
    border: 'none',
    color: T.primary,
    fontSize: 13,
    cursor: 'pointer',
  } as const;

  const titulo =
    mode === 'login'
      ? 'Entre para acessar sua conta'
      : mode === 'register'
        ? 'Crie sua conta grátis'
        : 'Recuperar senha';

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <AppLogo size={20} />
        <p style={{ color: T.muted, fontSize: 13, margin: '10px 0 0' }}>{titulo}</p>
      </div>

      {mode === 'forgot' ? (
        enviado ? (
          <>
            <p
              style={{
                color: T.text,
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: 'center',
                margin: 0,
              }}
            >
              Se existir uma conta com <b>{email}</b>, enviamos um link para redefinir a senha.
              Confira sua caixa de entrada <b>e o spam</b> — o link vale por 1 hora.
            </p>
            <Btn full onClick={() => trocarModo('login')}>
              Voltar ao login
            </Btn>
          </>
        ) : (
          <>
            <input
              placeholder="Seu e-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
            {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}
            <Btn full disabled={busy || !email} onClick={() => void submit()}>
              {busy ? 'Enviando…' : 'Enviar link de recuperação'}
            </Btn>
            <button onClick={() => trocarModo('login')} style={link}>
              Voltar ao login
            </button>
          </>
        )
      ) : (
        <>
          {mode === 'register' && (
            <input
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={input}
            />
          )}
          <input
            placeholder="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
          <div style={{ position: 'relative' }}>
            <input
              // `key` muda ao alternar visível/oculto: força o React a RECRIAR o input.
              // Sem isso, no iOS a senha preenchida pelo Keychain não revela ao trocar
              // type=password→text no mesmo elemento (trava de segurança do Safari).
              key={verSenha ? 'senha-visivel' : 'senha-oculta'}
              placeholder={mode === 'register' ? 'Senha (mín. 8 caracteres)' : 'Senha'}
              type={verSenha ? 'text' : 'password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ ...input, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 17,
                padding: 6,
                lineHeight: 1,
              }}
            >
              {verSenha ? '🙈' : '👁️'}
            </button>
          </div>

          {mode === 'register' && (
            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                color: T.muted,
                fontSize: 12.5,
                lineHeight: 1.45,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={aceito}
                onChange={(e) => setAceito(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span>
                Li e aceito a{' '}
                <a href="/privacidade.html" style={{ color: T.primary }}>
                  Política de Privacidade
                </a>{' '}
                e os{' '}
                <a href="/termos.html" style={{ color: T.primary }}>
                  Termos de Uso
                </a>
                .
              </span>
            </label>
          )}

          {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}

          <Btn
            full
            disabled={busy || !email || !senha || (mode === 'register' && !aceito)}
            onClick={() => void submit()}
          >
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Btn>

          {googleClientId && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                <div style={{ flex: 1, height: 1, background: T.border }} />
                <span style={{ color: T.muted, fontSize: 12 }}>ou</span>
                <div style={{ flex: 1, height: 1, background: T.border }} />
              </div>
              {/* Nosso botão (laranja translúcido, tamanho do "Entrar") com o botão REAL
                  do Google invisível por cima capturando o toque. No cadastro, o aceite
                  dos Termos destrava (pointerEvents). */}
              <div ref={googleWrapRef} style={{ position: 'relative', width: '100%' }}>
                <div
                  aria-hidden="true"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '14px 20px',
                    borderRadius: 14,
                    // Laranja translúcido (funciona no tema claro E escuro) — "meio
                    // transparente com laranja", no tamanho/forma do botão "Entrar".
                    border: `1px solid ${T.primary}66`,
                    background: `${T.primary}22`,
                    color: T.primary,
                    fontSize: 15,
                    fontWeight: 700,
                    opacity: busy || (mode === 'register' && !aceito) ? 0.5 : 1,
                    transition: 'opacity .15s',
                  }}
                >
                  <GoogleG />
                  {mode === 'register' ? 'Cadastrar com o Google' : 'Entrar com o Google'}
                </div>
                <div
                  ref={googleBtnRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    overflow: 'hidden',
                    pointerEvents: busy || (mode === 'register' && !aceito) ? 'none' : 'auto',
                  }}
                />
              </div>
              {mode === 'register' && !aceito && (
                <p style={{ color: T.muted, fontSize: 11.5, textAlign: 'center', margin: 0 }}>
                  Aceite os Termos acima para entrar com o Google.
                </p>
              )}
            </>
          )}

          {mode === 'login' && (
            <button onClick={() => trocarModo('forgot')} style={link}>
              Esqueci minha senha
            </button>
          )}
          <button onClick={() => trocarModo(mode === 'login' ? 'register' : 'login')} style={link}>
            {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
        </>
      )}

      <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: 11.5, color: T.muted }}>
        <a href="/privacidade.html" style={{ color: T.muted }}>
          Privacidade
        </a>{' '}
        ·{' '}
        <a href="/termos.html" style={{ color: T.muted }}>
          Termos
        </a>
      </p>
      <CreditoDev />
    </Card>
  );
}
