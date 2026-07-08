import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { AppLogo, Btn, Card } from '../../ui/kit';

/** Formulário de login/cadastro (mostrado no Perfil quando deslogado). */
export function AuthForm() {
  const { T } = useTheme();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErro(null);
    try {
      if (mode === 'login') await login(email, senha);
      else await register(email, nome, senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
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
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <AppLogo size={20} />
        <p style={{ color: T.muted, fontSize: 13, margin: '10px 0 0' }}>
          {mode === 'login' ? 'Entre para acessar sua conta' : 'Crie sua conta grátis'}
        </p>
      </div>

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
      <input
        placeholder={mode === 'register' ? 'Senha (mín. 8 caracteres)' : 'Senha'}
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        style={input}
      />

      {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}

      <Btn full disabled={busy || !email || !senha} onClick={() => void submit()}>
        {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
      </Btn>

      <button
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setErro(null);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: T.primary,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
      </button>
    </Card>
  );
}
