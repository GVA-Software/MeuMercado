import { useTheme } from '../../theme/theme';
import { AuthForm } from './AuthForm';

/** Portão de entrada: sem login, o app mostra só esta tela. */
export function AuthScreen() {
  const { T } = useTheme();
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
      <AuthForm />
      <p style={{ color: T.muted, fontSize: 12, textAlign: 'center', margin: '18px 0 0' }}>
        Crie sua conta grátis para começar a economizar nas compras.
      </p>
    </div>
  );
}
