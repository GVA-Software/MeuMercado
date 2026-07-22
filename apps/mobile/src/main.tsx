import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AuthProvider } from './auth/AuthContext';
import { RedefinirSenha } from './features/auth/RedefinirSenha';
import { ConfirmarEmail } from './features/auth/ConfirmarEmail';
import { ThemeProvider } from './theme/theme';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root não encontrado');

// Links do e-mail, abertos SEM passar pelo login/boot (não precisam de sessão):
//   ?reset=<token>           → tela de nova senha
//   ?verificar-email=<token> → confirma o e-mail
const params = new URLSearchParams(window.location.search);
const resetToken = params.get('reset');
const verificarToken = params.get('verificar-email');

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      {resetToken ? (
        <RedefinirSenha token={resetToken} />
      ) : verificarToken ? (
        <ConfirmarEmail token={verificarToken} />
      ) : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </ThemeProvider>
  </React.StrictMode>,
);
