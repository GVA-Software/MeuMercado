import type {
  AddCartItemInput,
  AuthResponse,
  CartDTO,
  CartMercadoDTO,
  CompraDTO,
  ComprasResponse,
  CreateProdutoInput,
  EanLookupDTO,
  EstimativaListaResponse,
  EventName,
  SavedListDTO,
  SavedListItemDTO,
  SavedListsResponse,
  FeedbackTipo,
  InsightsResponse,
  LoginInput,
  MercadoDTO,
  MercadoResumoDTO,
  NfceDraftDTO,
  NfceImportRequest,
  NfceImportResult,
  BaseResumoResponse,
  MelhorMercadoResponse,
  OndeComprarResponse,
  ReceitasResponse,
  PriceHistoryDTO,
  PriceSummaryDTO,
  PriceTableRowDTO,
  ProdutoDTO,
  ProdutoParaCompletarDTO,
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
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        ...init,
        // envia/recebe o cookie httpOnly de refresh
        credentials: 'include',
        // Timeout: NENHUMA requisição pode ficar pendurada pra sempre (ex.: conexão
        // meia-aberta ou service worker preso) — senão o botão trava em "Aguarde…"
        // eternamente. 45s cobre o cold start do Render e ainda vira erro (retentável).
        signal: init?.signal ?? AbortSignal.timeout(45_000),
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch (e) {
      // Falha de REDE (offline, cold start derrubando a conexão) ou TIMEOUT: normaliza
      // para ApiError status 0, para os chamadores distinguirem "sem servidor" de "erro
      // de sessão" (401) ou "erro do servidor" (5xx).
      const timeout = e instanceof DOMException && e.name === 'TimeoutError';
      throw new ApiError(
        0,
        timeout ? 'O servidor demorou a responder. Tente de novo.' : 'Sem conexão com o servidor.',
      );
    }
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
  /** Busca produto pelo código de barras (ao bipar). */
  buscarProdutoPorEan(ean: string): Promise<EanLookupDTO> {
    return this.request(`/produtos/por-ean/${encodeURIComponent(ean)}`);
  }
  /** Junta o produto `fromId` em `intoId` (move os preços). Só administradores. */
  juntarProduto(fromId: string, intoId: string): Promise<ProdutoDTO> {
    return this.request(`/produtos/${encodeURIComponent(fromId)}/merge`, {
      method: 'POST',
      body: JSON.stringify({ intoId }),
    });
  }

  // ---- Preços ----
  resumoPreco(produtoId: string): Promise<PriceSummaryDTO> {
    return this.request(`/prices/${encodeURIComponent(produtoId)}/summary`);
  }
  reportarPreco(input: ReportPriceInput): Promise<PriceSummaryDTO> {
    return this.request('/prices', { method: 'POST', body: JSON.stringify(input) });
  }
  tabelaPrecos(mercado?: string): Promise<PriceTableRowDTO[]> {
    return this.request(`/prices/table${mercado ? `?mercado=${encodeURIComponent(mercado)}` : ''}`);
  }
  mercadosPreco(): Promise<MercadoResumoDTO[]> {
    return this.request('/prices/mercados');
  }
  produtosParaCompletar(): Promise<ProdutoParaCompletarDTO[]> {
    return this.request('/prices/para-completar');
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
  /** Risca um item (comprei): grava preço + qtd e alimenta a base da comunidade. */
  marcarComprado(
    id: string,
    lineId: string,
    body: { precoCents: number; quantity: number },
  ): Promise<CartDTO> {
    return this.request(`/carts/${id}/items/${lineId}/comprado`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  /** Desmarca um item riscado (volta a planejado na lista). */
  desmarcarItem(id: string, lineId: string): Promise<CartDTO> {
    return this.request(`/carts/${id}/items/${lineId}/comprado`, { method: 'DELETE' });
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
  /** Semeia a lista com os itens da última compra (como planejados). */
  repetirUltimaCompra(id: string): Promise<CartDTO> {
    return this.request(`/carts/${id}/repetir-ultima`, { method: 'POST' });
  }
  /** Prévia do gasto da lista pela média da base (+ produtos sem preço). */
  estimarLista(
    itens: Array<{ produtoId: string; quantity: number }>,
  ): Promise<EstimativaListaResponse> {
    return this.request('/prices/estimativa', { method: 'POST', body: JSON.stringify({ itens }) });
  }

  // ---- Listas salvas (modelos reutilizáveis) ----
  salvarLista(nome: string, itens: SavedListItemDTO[]): Promise<SavedListDTO> {
    return this.request('/listas', { method: 'POST', body: JSON.stringify({ nome, itens }) });
  }
  listarListas(): Promise<SavedListsResponse> {
    return this.request('/listas');
  }
  excluirLista(id: string): Promise<void> {
    return this.request(`/listas/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  usarLista(cartId: string, listaId: string): Promise<CartDTO> {
    return this.request(`/carts/${cartId}/usar-lista/${encodeURIComponent(listaId)}`, {
      method: 'POST',
    });
  }

  // ---- Minhas compras (histórico) ----
  listarCompras(): Promise<ComprasResponse> {
    return this.request('/compras');
  }
  excluirCompra(id: string): Promise<void> {
    return this.request(`/compras/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  excluirTodasCompras(): Promise<void> {
    return this.request('/compras', { method: 'DELETE' });
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
  /** Busca de produto da Nina — só produtos com preço real (sem placeholders do seed). */
  ninaBuscarProdutos(q: string): Promise<ProdutoDTO[]> {
    return this.request(`/insights/produtos?q=${encodeURIComponent(q)}`);
  }
  /** "Onde eu compro este produto?" — melhores mercados por preço + distância. */
  ondeComprar(produtoId: string, lat?: number, lng?: number): Promise<OndeComprarResponse> {
    return this.request('/insights/onde-comprar', {
      method: 'POST',
      body: JSON.stringify({
        produtoId,
        ...(lat !== undefined ? { lat } : {}),
        ...(lng !== undefined ? { lng } : {}),
      }),
    });
  }
  /** "Qual o melhor mercado para [categoria]?" — recomenda um mercado. */
  /** Resumo da base comunitária (contagens + extremos), opcional filtro por termo. */
  baseResumo(termo?: string): Promise<BaseResumoResponse> {
    const q = (termo ?? '').trim();
    return this.request(`/insights/base${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }
  /** Receitas dinâmicas (ensinadas pelo ADM) — a Nina usa no "montar lista". */
  ninaReceitas(): Promise<ReceitasResponse> {
    return this.request('/insights/receitas');
  }
  melhorMercado(termo: string | null, lat?: number, lng?: number): Promise<MelhorMercadoResponse> {
    return this.request('/insights/melhor-mercado', {
      method: 'POST',
      body: JSON.stringify({
        ...(termo ? { termo } : {}), // sem termo = pergunta genérica (base toda)
        ...(lat !== undefined ? { lat } : {}),
        ...(lng !== undefined ? { lng } : {}),
      }),
    });
  }

  // ---- Auth ----
  register(input: RegisterInput): Promise<AuthResponse> {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify(input) });
  }
  login(input: LoginInput): Promise<AuthResponse> {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(input) });
  }
  /** Login com Google: envia o ID token (verificado no servidor). */
  loginGoogle(idToken: string, aceitouTermos: boolean): Promise<AuthResponse> {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, aceitouTermos }),
    });
  }
  /** Renova a sessão a partir do cookie httpOnly de refresh (mantém logado). */
  refresh(): Promise<AuthResponse> {
    return this.request('/auth/refresh', { method: 'POST' });
  }
  logout(): Promise<{ ok: true }> {
    return this.request('/auth/logout', { method: 'POST' });
  }
  /** Pede recuperação de senha (manda o link por e-mail). Sempre resolve. */
  esqueciSenha(email: string): Promise<void> {
    return this.request('/auth/esqueci-senha', { method: 'POST', body: JSON.stringify({ email }) });
  }
  /** Redefine a senha a partir do token do e-mail. */
  redefinirSenha(token: string, senha: string): Promise<void> {
    return this.request('/auth/redefinir-senha', {
      method: 'POST',
      body: JSON.stringify({ token, senha }),
    });
  }
  me(): Promise<UserDTO> {
    return this.request('/auth/me');
  }
  /**
   * Exclui a PRÓPRIA conta. Conta com senha → confirma com a senha; conta só-Google →
   * sem senha (o servidor dispensa, já autenticado por JWT). Os preços permanecem.
   */
  excluirConta(senha?: string): Promise<void> {
    return this.request('/auth/excluir-conta', {
      method: 'POST',
      body: JSON.stringify(senha ? { senha } : {}),
    });
  }
  /** Atualiza o próprio nome (persistido; e-mail não muda). */
  atualizarNome(nome: string): Promise<UserDTO> {
    return this.request('/auth/me', { method: 'PATCH', body: JSON.stringify({ nome }) });
  }
  /** Portabilidade LGPD: baixa TODOS os dados do titular em JSON. */
  baixarMeusDados(): Promise<Record<string, unknown>> {
    return this.request('/privacidade/meus-dados');
  }
  /** Registra o reaceite da Política/Termos (quando a versão muda). */
  aceitarPolitica(): Promise<UserDTO> {
    return this.request('/auth/aceitar-politica', { method: 'POST' });
  }

  // ---- Feedback ----
  enviarFeedback(tipo: FeedbackTipo, mensagem: string): Promise<void> {
    return this.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ tipo, mensagem }),
    });
  }

  // ---- Push notifications ----
  pushPublicKey(): Promise<{ publicKey: string }> {
    return this.request('/push/public-key');
  }
  pushSubscribe(sub: PushSubscriptionJSON): Promise<void> {
    return this.request('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
  }
  pushUnsubscribe(endpoint: string): Promise<void> {
    return this.request('/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  }

  // ---- Analytics (própria) ----
  /** Registra um evento de uso. Fire-and-forget: nunca bloqueia nem quebra a UI. */
  track(name: EventName, props?: Record<string, string | number | boolean>): void {
    void this.request('/events', {
      method: 'POST',
      body: JSON.stringify({ name, ...(props ? { props } : {}) }),
    }).catch(() => {});
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

/**
 * Converte qualquer erro numa mensagem amigável em pt-BR para o usuário final.
 * Erros do servidor (4xx) já vêm em pt-BR e específicos — usa-os; 5xx e falha de
 * rede viram texto genérico (nunca expõe "Failed to fetch"/stack ao usuário).
 */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Sem conexão agora. Confira sua internet e tente de novo.';
    if (e.status >= 400 && e.status < 500 && e.message) return e.message;
    return 'Algo deu errado do nosso lado. Tente de novo em instantes.';
  }
  return 'Sem conexão agora. Confira sua internet e tente de novo.';
}
