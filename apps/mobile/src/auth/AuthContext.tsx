import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Periodo, SubscriptionDTO, UserDTO } from '@meumercado/contracts';
import { api } from '../api/client';

interface AuthState {
  user: UserDTO | null;
  subscription: SubscriptionDTO | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (email: string, nome: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  assinar: (periodo: Periodo) => Promise<void>;
  cancelar: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const TOKEN_KEY = 'mm-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const applyAuth = useCallback(async (accessToken: string, u: UserDTO) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    api.setToken(accessToken);
    setUser(u);
    setSubscription(await api.billingMe());
  }, []);

  // Mantém a sessão ativa: no boot, renova pelo cookie httpOnly de refresh (14
  // dias, renovado a cada abertura). Só desloga quando o usuário clica em "Sair"
  // — sem pedir login toda vez que reabre o app.
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.refresh();
        await applyAuth(r.accessToken, r.user);
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
      await applyAuth(r.accessToken, r.user);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (email: string, nome: string, senha: string) => {
      const r = await api.register({ email, nome, senha });
      await applyAuth(r.accessToken, r.user);
    },
    [applyAuth],
  );

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

  const assinar = useCallback(async (periodo: Periodo) => {
    setSubscription(await api.assinar(periodo));
  }, []);

  const cancelar = useCallback(async () => {
    setSubscription(await api.cancelar());
  }, []);

  return (
    <Ctx.Provider
      value={{ user, subscription, loading, login, register, logout, assinar, cancelar }}
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
