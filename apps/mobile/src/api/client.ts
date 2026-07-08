import type {
  AddCartItemInput,
  AuthResponse,
  CartDTO,
  InsightsResponse,
  LoginInput,
  MercadoDTO,
  Periodo,
  PriceSummaryDTO,
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

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
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

  // ---- Catálogo ----
  listarProdutos(): Promise<ProdutoDTO[]> {
    return this.request('/produtos');
  }
  buscarProdutos(q: string): Promise<ProdutoDTO[]> {
    return this.request(`/produtos/search?q=${encodeURIComponent(q)}`);
  }

  // ---- Preços ----
  resumoPreco(produtoId: string): Promise<PriceSummaryDTO> {
    return this.request(`/prices/${encodeURIComponent(produtoId)}/summary`);
  }
  reportarPreco(input: ReportPriceInput): Promise<PriceSummaryDTO> {
    return this.request('/prices', { method: 'POST', body: JSON.stringify(input) });
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

  // ---- Mercados (aba Mapa) ----
  mercados(): Promise<MercadoDTO[]> {
    return this.request('/markets');
  }
  mercadosProximos(lat: number, lng: number, raioMetros = 50000): Promise<MercadoDTO[]> {
    return this.request(`/markets/nearby?lat=${lat}&lng=${lng}&raioMetros=${raioMetros}&limit=50`);
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
  logout(): Promise<{ ok: true }> {
    return this.request('/auth/logout', { method: 'POST' });
  }
  me(): Promise<UserDTO> {
    return this.request('/auth/me');
  }

  // ---- Billing / assinatura ----
  billingMe(): Promise<SubscriptionDTO> {
    return this.request('/billing/me');
  }
  assinar(periodo: Periodo): Promise<SubscriptionDTO> {
    return this.request('/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ periodo }),
    });
  }
  iniciarTrial(): Promise<SubscriptionDTO> {
    return this.request('/billing/trial', { method: 'POST' });
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
