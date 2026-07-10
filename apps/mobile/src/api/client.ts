import type {
  AddCartItemInput,
  AuthResponse,
  CartDTO,
  CartMercadoDTO,
  CompraDTO,
  ComprasResponse,
  CreateProdutoInput,
  InsightsResponse,
  LoginInput,
  MercadoDTO,
  MercadoResumoDTO,
  NfceDraftDTO,
  NfceImportRequest,
  NfceImportResult,
  PriceHistoryDTO,
  PriceSummaryDTO,
  PriceTableRowDTO,
  ProdutoDTO,
  RegisterInput,
  ReportPriceInput,
  SubscriptionDTO,
  UserDTO,
} from '@meumercado/contracts';

const BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Cliente HTTP tipado da API. Usa os tipos de `@meumercado/contracts`, então o
 * front e o back compartilham exatamente o mesmo formato de dados.
 */
export class ApiClient {
  private token: string | null = null;

  constructor(private readonly base: string = `${BASE}/api`) {}

  /** Define o access token enviado como Bearer nas próximas requisições. */
  setToken(token: string | null): void {
    this.token = token;
  }

  private refreshInFlight: Promise<boolean> | null = null;

  private async request<T>(path: string, init?: RequestInit, retryOn401 = true): Promise<T> {
    const res = await fetch(this.base + path, {
      ...init,
      // envia/recebe o cookie httpOnly de refresh
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    // Access token expirou? Renova pelo refresh cookie e tenta de novo (1x).
    if (res.status === 401 && retryOn401 && !path.startsWith('/auth/')) {
      if (await this.tryRefresh()) {
        return this.request<T>(path, init, false);
      }
    }
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) msg = body.message;
      } catch {
        /* corpo não-JSON */
      }
      throw new ApiError(res.status, msg);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  /** Renova o access token via cookie de refresh. Compartilha 1 requisição concorrente. */
  private tryRefresh(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = (async () => {
        try {
          const res = await fetch(this.base + '/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
          });
          if (!res.ok) return false;
          const body = (await res.json()) as AuthResponse;
          this.setToken(body.accessToken);
          return true;
        } catch {
          return false;
        }
      })();
      void this.refreshInFlight.finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  // ---- Catálogo ----
  listarProdutos(): Promise<ProdutoDTO[]> {
    return this.request('/produtos');
  }
  buscarProdutos(q: string): Promise<ProdutoDTO[]> {
    return this.request(`/produtos/search?q=${encodeURIComponent(q)}`);
  }
  criarProduto(input: CreateProdutoInput): Promise<ProdutoDTO> {
    return this.request('/produtos', { method: 'POST', body: JSON.stringify(input) });
  }

  // ---- Preços ----
  resumoPreco(produtoId: string): Promise<PriceSummaryDTO> {
    return this.request(`/prices/${encodeURIComponent(produtoId)}/summary`);
  }
  reportarPreco(input: ReportPriceInput): Promise<PriceSummaryDTO> {
    return this.request('/prices', { method: 'POST', body: JSON.stringify(input) });
  }
  tabelaPrecos(mercado?: string): Promise<PriceTableRowDTO[]> {
    return this.request(
      `/prices/table${mercado ? `?mercado=${encodeURIComponent(mercado)}` : ''}`,
    );
  }
  mercadosPreco(): Promise<MercadoResumoDTO[]> {
    return this.request('/prices/mercados');
  }
  historicoPreco(produtoId: string): Promise<PriceHistoryDTO> {
    return this.request(`/prices/${encodeURIComponent(produtoId)}/history`);
  }

  // ---- Nota fiscal (NFC-e via QR) ----
  nfcePreview(url: string): Promise<NfceDraftDTO> {
    return this.request('/nfce/preview', { method: 'POST', body: JSON.stringify({ url }) });
  }
  nfceImportar(req: NfceImportRequest): Promise<NfceImportResult> {
    return this.request('/nfce/importar', { method: 'POST', body: JSON.stringify(req) });
  }

  // ---- Carrinho ----
  criarCarrinho(): Promise<CartDTO> {
    return this.request('/carts', { method: 'POST' });
  }
  obterCarrinho(id: string): Promise<CartDTO> {
    return this.request(`/carts/${id}`);
  }
  adicionarItem(id: string, input: AddCartItemInput): Promise<CartDTO> {
    return this.request(`/carts/${id}/items`, { method: 'POST', body: JSON.stringify(input) });
  }
  alterarQuantidade(id: string, lineId: string, quantity: number): Promise<CartDTO> {
    return this.request(`/carts/${id}/items/${lineId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  }
  removerItem(id: string, lineId: string): Promise<CartDTO> {
    return this.request(`/carts/${id}/items/${lineId}`, { method: 'DELETE' });
  }
  definirLimite(id: string, limiteCents: number | null): Promise<CartDTO> {
    return this.request(`/carts/${id}/limite`, {
      method: 'PUT',
      body: JSON.stringify({ limiteCents }),
    });
  }
  definirMercadoCarrinho(id: string, mercado: CartMercadoDTO): Promise<CartDTO> {
    return this.request(`/carts/${id}/mercado`, { method: 'PUT', body: JSON.stringify(mercado) });
  }
  removerMercadoCarrinho(id: string): Promise<CartDTO> {
    return this.request(`/carts/${id}/mercado`, { method: 'DELETE' });
  }
  finalizarCompra(id: string): Promise<CompraDTO> {
    return this.request(`/carts/${id}/finalizar`, { method: 'POST' });
  }

  // ---- Minhas compras (histórico) ----
  listarCompras(): Promise<ComprasResponse> {
    return this.request('/compras');
  }

  // ---- Mercados (aba Mapa) ----
  mercados(): Promise<MercadoDTO[]> {
    return this.request('/markets');
  }
  mercadosProximos(lat: number, lng: number, raioMetros = 50000): Promise<MercadoDTO[]> {
    return this.request(`/markets/nearby?lat=${lat}&lng=${lng}&raioMetros=${raioMetros}&limit=50`);
  }
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const r = await this.request<{ endereco: string | null }>(
      `/geocode/reverse?lat=${lat}&lng=${lng}`,
    );
    return r.endereco;
  }

  // ---- Nina ----
  insights(): Promise<InsightsResponse> {
    return this.request('/insights');
  }
  insightsCesta(
    itens: Array<{ produtoId: string; nome: string; quantity: number }>,
  ): Promise<InsightsResponse> {
    return this.request('/insights/cesta', { method: 'POST', body: JSON.stringify({ itens }) });
  }

  // ---- Auth ----
  register(input: RegisterInput): Promise<AuthResponse> {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify(input) });
  }
  login(input: LoginInput): Promise<AuthResponse> {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(input) });
  }
  /** Renova a sessão a partir do cookie httpOnly de refresh (mantém logado). */
  refresh(): Promise<AuthResponse> {
    return this.request('/auth/refresh', { method: 'POST' });
  }
  logout(): Promise<{ ok: true }> {
    return this.request('/auth/logout', { method: 'POST' });
  }
  me(): Promise<UserDTO> {
    return this.request('/auth/me');
  }
  /** Atualiza o próprio nome (persistido; e-mail não muda). */
  atualizarNome(nome: string): Promise<UserDTO> {
    return this.request('/auth/me', { method: 'PATCH', body: JSON.stringify({ nome }) });
  }

  // ---- Push notifications ----
  pushPublicKey(): Promise<{ publicKey: string }> {
    return this.request('/push/public-key');
  }
  pushSubscribe(sub: PushSubscriptionJSON): Promise<void> {
    return this.request('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
  }
  pushUnsubscribe(endpoint: string): Promise<void> {
    return this.request('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
  }

  // ---- Billing / assinatura ----
  // Conceder Pro/Nina é exclusivo do painel de ADM; o app só consulta e cancela.
  billingMe(): Promise<SubscriptionDTO> {
    return this.request('/billing/me');
  }
  cancelar(): Promise<SubscriptionDTO> {
    return this.request('/billing/cancel', { method: 'POST' });
  }
}

/** Instância única usada pelas telas. */
export const api = new ApiClient();

/** Formata centavos em BRL — "R$ 28,90". */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
