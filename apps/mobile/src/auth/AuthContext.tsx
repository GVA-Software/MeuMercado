import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SubscriptionDTO, UserDTO } from '@meumercado/contracts';
import { api, ApiError } from '../api/client';

interface AuthState {
  user: UserDTO | null;
  subscription: SubscriptionDTO | null;
  loading: boolean;
  /** No boot: o servidor está subindo (cold start do Render) — mostra "acordando…". */
  acordando: boolean;
  /** No boot: esgotou as tentativas de acordar o servidor (sem deslogar). */
  bootErro: boolean;
  /** Re-tenta conectar após um bootErro. */
  tentarConectar: () => void;
  login: (email: string, senha: string) => Promise<void>;
  register: (email: string, nome: string, senha: string) => Promise<void>;
  atualizarNome: (nome: string) => Promise<void>;
  /** Registra o reaceite da Política/Termos (quando a versão muda). */
  aceitarPolitica: () => Promise<void>;
  logout: () => Promise<void>;
  cancelar: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const TOKEN_KEY = 'mm-token';

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [acordando, setAcordando] = useState(false);
  const [bootErro, setBootErro] = useState(false);

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
  //
  // Cold start do Render: o servidor free dorme após ~15 min e leva ~30-50s pra
  // subir. Nessa janela o refresh DEMORA ou FALHA por rede/5xx — e isso NÃO é logout.
  // Só 401/403 significa sessão inválida. Então: re-tenta com backoff mostrando
  // "acordando…"; se esgotar, cai num bootErro com "tentar de novo" (nunca joga o
  // usuário logado pra tela de login por causa de um servidor frio).
  const iniciar = useCallback(async (): Promise<void> => {
    setBootErro(false);
    setLoading(true);
    const MAX_TENTATIVAS = 12; // ~1 min de cobertura, folga pro cold start do Render
    for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
      try {
        const r = await api.refresh();
        applyAuth(r.accessToken, r.user);
        setAcordando(false);
        setLoading(false);
        return;
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 401 || status === 403) {
          // Sessão realmente inválida/expirada → login limpo.
          localStorage.removeItem(TOKEN_KEY);
          api.setToken(null);
          setAcordando(false);
          setLoading(false);
          return;
        }
        // Servidor frio (status 0 rede / 5xx / 503 do Render): avisa e re-tenta.
        setAcordando(true);
        await esperar(Math.min(2000 + tentativa * 800, 6000));
      }
    }
    // Esgotou: servidor indisponível. NÃO desloga — oferece "tentar de novo".
    setAcordando(false);
    setBootErro(true);
    setLoading(false);
  }, [applyAuth]);

  useEffect(() => {
    void iniciar();
  }, [iniciar]);

  const login = useCallback(
    async (email: string, senha: string) => {
      const r = await api.login({ email, senha });
      applyAuth(r.accessToken, r.user);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (email: string, nome: string, senha: string) => {
      // O consentimento é obrigatório na tela de cadastro (checkbox trava o botão).
      const r = await api.register({ email, nome, senha, aceitouTermos: true });
      applyAuth(r.accessToken, r.user);
    },
    [applyAuth],
  );

  const atualizarNome = useCallback(async (nome: string) => {
    setUser(await api.atualizarNome(nome));
  }, []);

  const aceitarPolitica = useCallback(async () => {
    setUser(await api.aceitarPolitica());
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
      value={{
        user,
        subscription,
        loading,
        acordando,
        bootErro,
        tentarConectar: () => void iniciar(),
        login,
        register,
        atualizarNome,
        aceitarPolitica,
        logout,
        cancelar,
      }}
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
