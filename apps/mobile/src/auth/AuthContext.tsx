import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SubscriptionDTO, UserDTO } from '@meumercado/contracts';
import { api } from '../api/client';

interface AuthState {
  user: UserDTO | null;
  subscription: SubscriptionDTO | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (email: string, nome: string, senha: string) => Promise<void>;
  atualizarNome: (nome: string) => Promise<void>;
  logout: () => Promise<void>;
  cancelar: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const TOKEN_KEY = 'mm-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const applyAuth = useCallback((accessToken: string, u: UserDTO) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    api.setToken(accessToken);
    setUser(u);
    // A assinatura não bloqueia a abertura do app: carrega em segundo plano
    // (uma ida a menos ao servidor no "cold start" do Render → boot mais rápido).
    void api
      .billingMe()
      .then(setSubscription)
      .catch(() => {});
  }, []);

  /** Reconsulta a assinatura (plano) do servidor e atualiza o estado. */
  const refreshSubscription = useCallback(async () => {
    try {
      setSubscription(await api.billingMe());
    } catch {
      /* mantém o estado atual em caso de falha */
    }
  }, []);

  // Mantém a sessão ativa: no boot, renova pelo cookie httpOnly de refresh (14
  // dias, renovado a cada abertura). Só desloga quando o usuário clica em "Sair"
  // — sem pedir login toda vez que reabre o app.
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.refresh();
        applyAuth(r.accessToken, r.user);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        api.setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [applyAuth]);

  const login = useCallback(
    async (email: string, senha: string) => {
      const r = await api.login({ email, senha });
      applyAuth(r.accessToken, r.user);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (email: string, nome: string, senha: string) => {
      const r = await api.register({ email, nome, senha });
      applyAuth(r.accessToken, r.user);
    },
    [applyAuth],
  );

  const atualizarNome = useCallback(async (nome: string) => {
    setUser(await api.atualizarNome(nome));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignora falha de logout */
    }
    localStorage.removeItem(TOKEN_KEY);
    api.setToken(null);
    setUser(null);
    setSubscription(null);
  }, []);

  const cancelar = useCallback(async () => {
    setSubscription(await api.cancelar());
  }, []);

  // Propaga em TEMPO REAL mudanças de plano (ex.: o ADM liberou/encerrou o Pro)
  // enquanto o app está aberto: reconsulta ao voltar o foco, num intervalo leve,
  // e imediatamente quando o service worker avisa que chegou um push.
  useEffect(() => {
    if (!user) return;
    const atualizar = () => {
      if (document.visibilityState === 'visible') void refreshSubscription();
    };
    const id = window.setInterval(atualizar, 60_000);
    document.addEventListener('visibilitychange', atualizar);
    const sw = navigator.serviceWorker;
    const onMsg = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === 'mm-refresh-billing') {
        void refreshSubscription();
      }
    };
    sw?.addEventListener?.('message', onMsg);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', atualizar);
      sw?.removeEventListener?.('message', onMsg);
    };
  }, [user, refreshSubscription]);

  return (
    <Ctx.Provider
      value={{ user, subscription, loading, login, register, atualizarNome, logout, cancelar }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
