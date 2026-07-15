import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AuthProvider } from './auth/AuthContext';
import { RedefinirSenha } from './features/auth/RedefinirSenha';
import { ThemeProvider } from './theme/theme';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root não encontrado');

// Link de recuperação de senha (`?reset=<token>`): abre a tela de nova senha direto,
// sem passar pelo login/boot do app (não precisa de sessão).
const resetToken = new URLSearchParams(window.location.search).get('reset');

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      {resetToken ? (
        <RedefinirSenha token={resetToken} />
      ) : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </ThemeProvider>
  </React.StrictMode>,
);
