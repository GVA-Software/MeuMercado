import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  CartDTO,
  CartItemDTO,
  CartMercadoDTO,
  MercadoDTO,
  ProdutoDTO,
} from '@meumercado/contracts';
import { combinaBusca } from '@meumercado/domain';
import { api, formatBRL, mensagemDeErro } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import {
  AppLogo,
  AvisoDialog,
  Btn,
  Card,
  CartLoader,
  ConfirmDialog,
  CurrencyInput,
  EmptyState,
  SLabel,
  ThemeToggle,
} from '../../ui/kit';
import { MarketTag } from '../../ui/market';
import { emojiDe } from '../../ui/emoji';
import { MinhasCompras } from '../compras/MinhasCompras';
import { BarcodeScanner } from '../scan/BarcodeScanner';

/** Saudação conforme a hora do dia. */
function saudacaoDoDia(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Frase acolhedora (tom da Nina) conforme a hora. */
function fraseAcolhedora(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bora começar o dia economizando? 🌱';
  if (h < 18) return 'Pronto pra fazer aquela compra inteligente? 💚';
  return 'A Nina está de olho nas melhores ofertas ✨';
}

export function CompraScreen() {
  const { T } = useTheme();
  const { user } = useAuth();
  const primeiroNome = user?.nome?.trim().split(/\s+/)[0] ?? '';
  const [cart, setCart] = useState<CartDTO | null>(null);
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [comprasOpen, setComprasOpen] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [finalizarErro, setFinalizarErro] = useState<string | null>(null);
  const [limiteMsg, setLimiteMsg] = useState<string | null>(null);
  const [mercadoNudge, setMercadoNudge] = useState(false);
  // Estado do seletor de mercado (elevado): tanto a barra "comprando em" quanto o
  // nudge de finalizar podem abri-lo.
  const [mercadoOpen, setMercadoOpen] = useState(false);
  // Trava uma mutação por vez no carrinho: evita duplo-toque no +/−/🗑️ (que,
  // por enviar quantidade ABSOLUTA lida do render, perderia incrementos).
  const [mutando, setMutando] = useState(false);
  // Item que o usuário está riscando (abre o modal de preço + quantidade).
  const [riscando, setRiscando] = useState<CartItemDTO | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const id = localStorage.getItem('mm-cart');
        let c: CartDTO;
        try {
          c = id ? await api.obterCarrinho(id) : await api.criarCarrinho();
        } catch {
          c = await api.criarCarrinho();
        }
        localStorage.setItem('mm-cart', c.id);
        setCart(c);
        setProdutos(await api.listarProdutos());
      } catch (e) {
        setError(mensagemDeErro(e));
      }
    })();
  }, []);

  const status = cart?.status ?? 'sem-limite';
  const barColor = status === 'estourado' ? T.danger : status === 'alerta' ? T.yellow : T.green;
  const progress = cart?.progressPercent ?? 0;

  async function adicionar(p: ProdutoDTO, precoCents: number, qty: number) {
    if (!cart) return;
    const updated = await api.adicionarItem(cart.id, {
      produtoId: p.id,
      nome: p.nome,
      // Sem preço = item PLANEJADO da lista (o preço vem ao riscar no mercado).
      ...(precoCents > 0 ? { unitPriceCents: precoCents } : {}),
      quantity: qty,
      ...(p.emoji !== undefined ? { emoji: p.emoji } : {}),
    });
    setCart(updated);
    setAddOpen(false);
  }

  /** Risca um item da lista: grava o preço pago + qtd (e alimenta a base). */
  async function confirmarCompra(precoCents: number, quantity: number) {
    if (!cart || !riscando) return;
    const updated = await api.marcarComprado(cart.id, riscando.lineId, { precoCents, quantity });
    setCart(updated);
    setRiscando(null);
  }

  /** Desmarca um item (volta a planejado). O preço já reportado fica na base. */
  async function desmarcar(lineId: string) {
    if (!cart || mutando) return;
    setMutando(true);
    try {
      setCart(await api.desmarcarItem(cart.id, lineId));
    } catch {
      /* mantém o carrinho atual */
    } finally {
      setMutando(false);
    }
  }

  async function mudarQtd(lineId: string, novo: number) {
    if (!cart || mutando) return;
    setMutando(true);
    try {
      setCart(
        novo < 1
          ? await api.removerItem(cart.id, lineId)
          : await api.alterarQuantidade(cart.id, lineId, novo),
      );
    } catch {
      /* falhou: mantém o carrinho atual (sem quebrar a tela) */
    } finally {
      setMutando(false);
    }
  }

  async function removerLinha(lineId: string) {
    if (!cart || mutando) return;
    setMutando(true);
    try {
      setCart(await api.removerItem(cart.id, lineId));
    } catch {
      /* mantém o carrinho atual */
    } finally {
      setMutando(false);
    }
  }

  async function definirLimite(valor: number | null) {
    if (!cart) return;
    const tinha = cart.limite !== null;
    setCart(await api.definirLimite(cart.id, valor));
    setLimiteMsg(
      valor === null
        ? 'Limite removido com sucesso'
        : tinha
          ? 'Limite alterado com sucesso'
          : 'Limite cadastrado com sucesso',
    );
  }

  // Incentivo: sem mercado informado, a compra não enriquece a base. Pede antes.
  function finalizar() {
    if (!cart || cart.items.every((i) => !i.comprado)) return;
    if (!cart.mercado) {
      setMercadoNudge(true);
      return;
    }
    void finalizarDeFato();
  }

  async function finalizarDeFato() {
    if (!cart || cart.items.every((i) => !i.comprado)) return;
    setMercadoNudge(false);
    setFinalizando(true);
    setFinalizarErro(null);
    try {
      await api.finalizarCompra(cart.id);
      setCart(await api.obterCarrinho(cart.id)); // agora vazio
      setComprasOpen(true);
    } catch (e) {
      setFinalizarErro(mensagemDeErro(e));
    } finally {
      setFinalizando(false);
    }
  }

  if (error) {
    return (
      <div style={{ padding: 20, paddingBottom: 100 }}>
        <EmptyState emoji="😕" titulo="Não conseguimos conectar agora" sub={error} />
        <div style={{ textAlign: 'center' }}>
          <Btn small onClick={() => window.location.reload()}>
            Tentar de novo
          </Btn>
        </div>
      </div>
    );
  }

  // Enquanto o carrinho carrega, mostra o loader do carrinho (evita o "flash" de
  // tracinhos "—" no preço antes dos dados chegarem).
  if (!cart) {
    return <CartLoader label="Preparando seu carrinho…" center />;
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: T.headerBg,
          padding: '20px 20px 28px',
          borderRadius: '0 0 28px 28px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <AppLogo size={18} inverted />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ThemeToggle />
            <button
              onClick={() => setAddOpen((v) => !v)}
              style={{
                background: '#FFF',
                border: 'none',
                borderRadius: 14,
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Saudação acolhedora (tom da Nina) */}
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              color: T.headerText,
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
              letterSpacing: -0.3,
            }}
          >
            {saudacaoDoDia()}
            {primeiroNome ? `, ${primeiroNome}` : ''}
          </p>
          <p style={{ color: T.headerText, opacity: 0.75, fontSize: 13, margin: '4px 0 0' }}>
            {fraseAcolhedora()}
          </p>
          <p style={{ color: T.headerText, opacity: 0.4, fontSize: 10, margin: '6px 0 0' }}>
            versão {__BUILD_ID__}
          </p>
        </div>

        <div
          style={{
            background: T.surface,
            borderRadius: 20,
            padding: '16px 18px',
            boxShadow: `0 4px 20px ${T.shadow}`,
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <p style={{ color: T.muted, fontSize: 12, margin: '0 0 2px' }}>Carrinho atual</p>
              <p
                style={{
                  color: T.text,
                  fontSize: 34,
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: -1,
                }}
              >
                {cart ? formatBRL(cart.total.cents) : '—'}
              </p>
            </div>
            <LimiteEditor limiteCents={cart?.limite?.cents ?? null} onChange={definirLimite} />
          </div>

          {cart?.limite && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  background: T.card,
                  borderRadius: 99,
                  height: 7,
                  overflow: 'hidden',
                  marginBottom: 5,
                }}
              >
                <div
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    height: '100%',
                    background: barColor,
                    transition: 'width 0.4s',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: barColor, fontWeight: 700 }}>
                  {status === 'estourado'
                    ? 'Limite ultrapassado!'
                    : `${progress.toFixed(0)}% usado`}
                </span>
                <span style={{ color: T.muted }}>
                  {cart.remaining && cart.remaining.cents >= 0
                    ? `Faltam ${formatBRL(cart.remaining.cents)}`
                    : cart.remaining
                      ? `+${formatBRL(Math.abs(cart.remaining.cents))}`
                      : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* "Iniciar compra" (check-in) só faz sentido DEPOIS de montar a lista. */}
        {cart && cart.items.length > 0 && (
          <MercadoDaCompra
            cart={cart}
            onCart={setCart}
            open={mercadoOpen}
            setOpen={setMercadoOpen}
          />
        )}

        <button
          onClick={() => setComprasOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '12px 14px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 18 }}>🧾</span>
          <span style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: 700 }}>
            Minhas compras
          </span>
          <span style={{ color: T.muted, fontSize: 13 }}>histórico ›</span>
        </button>

        {addOpen && (
          <AddPanel produtos={produtos} onAdd={adicionar} onClose={() => setAddOpen(false)} />
        )}

        {cart && cart.items.length === 0 && !addOpen ? (
          <Card>
            <EmptyState
              emoji="📝"
              titulo="Monte sua lista de compras"
              sub="Adicione o que você precisa — mesmo sem saber o preço ainda."
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                margin: '0 auto 16px',
                maxWidth: 300,
              }}
            >
              {[
                { n: '1', t: 'Monte a lista aqui, em casa ou na fila' },
                { n: '2', t: 'No mercado, toque em ▶️ Iniciar compra' },
                { n: '3', t: 'Vá riscando o que pegar e informe o preço' },
              ].map((p) => (
                <div key={p.n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      borderRadius: 99,
                      background: T.primaryBg,
                      color: T.primary,
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.n}
                  </span>
                  <span style={{ color: T.sub, fontSize: 13 }}>{p.t}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Btn small onClick={() => setAddOpen(true)}>
                ＋ Adicionar à lista
              </Btn>
            </div>
          </Card>
        ) : (
          cart &&
          cart.items.length > 0 &&
          (() => {
            const riscados = cart.items.filter((i) => i.comprado).length;
            const total = cart.items.length;
            const tudoRiscado = riscados === total;
            return (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px 4px',
                  }}
                >
                  <SLabel>
                    Lista · {riscados} de {total} {total === 1 ? 'item' : 'itens'}
                  </SLabel>
                  {riscados > 0 && (
                    <span style={{ color: T.green, fontSize: 12, fontWeight: 700 }}>
                      {tudoRiscado ? '✓ tudo riscado' : `${riscados} riscado${riscados > 1 ? 's' : ''}`}
                    </span>
                  )}
                </div>
                {cart.items.map((item) => {
                  const comprado = item.comprado && item.unitPrice;
                  return (
                    <div
                      key={item.lineId}
                      style={{
                        background: comprado ? T.card : T.surface,
                        borderRadius: 16,
                        padding: 13,
                        border: `1px solid ${T.border}`,
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        boxShadow: comprado ? 'none' : `0 1px 4px ${T.shadow}`,
                      }}
                    >
                      <CheckBox
                        checked={item.comprado}
                        disabled={mutando}
                        onClick={() =>
                          item.comprado ? void desmarcar(item.lineId) : setRiscando(item)
                        }
                      />
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: T.primaryBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          opacity: item.comprado ? 0.55 : 1,
                        }}
                      >
                        {emojiDe(item)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            color: item.comprado ? T.muted : T.text,
                            fontSize: 14,
                            fontWeight: 700,
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textDecoration: item.comprado ? 'line-through' : 'none',
                          }}
                        >
                          {item.nome}
                        </p>
                        {comprado ? (
                          <p
                            style={{
                              color: T.green,
                              fontSize: 13,
                              fontWeight: 600,
                              margin: '2px 0 0',
                            }}
                          >
                            {formatBRL(item.unitPrice!.cents)} × {item.quantity} ={' '}
                            {formatBRL(item.subtotal.cents)}
                          </p>
                        ) : (
                          <p style={{ color: T.muted, fontSize: 12, margin: '2px 0 0' }}>
                            A comprar · toque em ○ ao pegar
                          </p>
                        )}
                      </div>
                      {item.comprado ? (
                        <button
                          onClick={() => void removerLinha(item.lineId)}
                          disabled={mutando}
                          aria-label="Remover item"
                          title="Remover item"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: T.muted,
                            fontSize: 16,
                            padding: '4px 2px',
                          }}
                        >
                          🗑️
                        </button>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <QtyBtn
                              label="−"
                              disabled={mutando}
                              onClick={() => void mudarQtd(item.lineId, item.quantity - 1)}
                            />
                            <span
                              style={{
                                color: T.text,
                                fontWeight: 700,
                                fontSize: 13,
                                minWidth: 16,
                                textAlign: 'center',
                              }}
                            >
                              {item.quantity}
                            </span>
                            <QtyBtn
                              label="+"
                              color={T.primary}
                              disabled={mutando}
                              onClick={() => void mudarQtd(item.lineId, item.quantity + 1)}
                            />
                          </div>
                          <button
                            onClick={() => void removerLinha(item.lineId)}
                            disabled={mutando}
                            aria-label="Remover item"
                            title="Remover item"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: T.muted,
                              fontSize: 16,
                              padding: '4px 2px',
                              marginLeft: 2,
                            }}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                <div
                  style={{
                    background: T.primaryBg,
                    borderRadius: 14,
                    padding: '13px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ color: T.primary, fontWeight: 700, fontSize: 14 }}>
                    {riscados > 0 ? 'Total riscado' : 'Total do carrinho'}
                  </span>
                  <span style={{ color: T.primary, fontWeight: 800, fontSize: 20 }}>
                    {formatBRL(cart.total.cents)}
                  </span>
                </div>

                {riscados === 0 ? (
                  <p style={{ color: T.muted, fontSize: 13, margin: 0, textAlign: 'center' }}>
                    Risque os itens que você pegou (toque no ○) para fechar a compra.
                  </p>
                ) : (
                  <Btn full disabled={finalizando} onClick={() => void finalizar()}>
                    {finalizando ? 'Finalizando…' : '✓ Finalizar compra'}
                  </Btn>
                )}
                {finalizarErro && (
                  <p style={{ color: T.danger, fontSize: 13, margin: 0, textAlign: 'center' }}>
                    {finalizarErro}
                  </p>
                )}
              </>
            );
          })()
        )}
      </div>

      {comprasOpen && <MinhasCompras onClose={() => setComprasOpen(false)} />}

      {limiteMsg && <AvisoDialog emoji="🎯" titulo={limiteMsg} onOk={() => setLimiteMsg(null)} />}

      {mercadoNudge && (
        <ConfirmDialog
          emoji="🏷️"
          titulo="Falta o mercado!"
          mensagem="Sem o mercado, seus preços não entram na comparação da comunidade nem ajudam a Nina. Quer informar antes de finalizar?"
          confirmarLabel="📍 Informar mercado"
          cancelarLabel="Finalizar assim mesmo"
          onConfirmar={() => {
            setMercadoNudge(false);
            setMercadoOpen(true);
          }}
          onCancelar={() => void finalizarDeFato()}
        />
      )}

      {riscando && (
        <RiscarSheet
          item={riscando}
          onConfirm={confirmarCompra}
          onClose={() => setRiscando(null)}
        />
      )}
    </div>
  );
}

/** Checkbox redondo da lista: vazio (a comprar) → verde com ✓ (comprado). */
function CheckBox({
  checked,
  onClick,
  disabled = false,
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={checked ? 'Desmarcar item' : 'Marcar como comprado'}
      title={checked ? 'Desmarcar' : 'Marcar como comprado'}
      style={{
        flexShrink: 0,
        width: 30,
        height: 30,
        borderRadius: 99,
        border: checked ? 'none' : `2px solid ${T.border}`,
        background: checked ? T.green : 'transparent',
        color: '#FFF',
        fontSize: 15,
        fontWeight: 800,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? '✓' : ''}
    </button>
  );
}

/** Modal de "riscar": digita o preço pago + a quantidade ao pegar o item. */
function RiscarSheet({
  item,
  onConfirm,
  onClose,
}: {
  item: CartItemDTO;
  onConfirm: (precoCents: number, quantity: number) => Promise<void>;
  onClose: () => void;
}) {
  const { T } = useTheme();
  const [precoCents, setPrecoCents] = useState(item.unitPrice?.cents ?? 0);
  const [qty, setQty] = useState(item.quantity);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (precoCents <= 0 || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      await onConfirm(precoCents, qty);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: T.surface,
          borderRadius: '24px 24px 0 0',
          padding: '18px 20px calc(24px + env(safe-area-inset-bottom))',
          maxHeight: '86vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{ width: 40, height: 4, background: T.border, borderRadius: 99, margin: '0 auto 16px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 26 }}>{emojiDe(item)}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: T.muted, fontSize: 12, margin: 0 }}>Peguei este item 🛒</p>
            <p
              style={{
                color: T.text,
                fontSize: 17,
                fontWeight: 800,
                margin: '2px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.nome}
            </p>
          </div>
        </div>

        <SLabel>Preço pago (unitário)</SLabel>
        <CurrencyInput
          autoFocus
          cents={precoCents}
          onCents={setPrecoCents}
          onEnter={confirmar}
          placeholder="Preço R$"
          style={{ width: '100%', marginBottom: 14 }}
        />

        <SLabel>Quantidade</SLabel>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 14,
            background: T.card,
            border: `1.5px solid ${T.border}`,
            borderRadius: 12,
            padding: '4px 14px',
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            style={{ background: 'none', border: 'none', color: T.text, fontSize: 22, cursor: 'pointer' }}
          >
            −
          </button>
          <span style={{ color: T.text, fontWeight: 800, minWidth: 20, textAlign: 'center', fontSize: 16 }}>
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(999, q + 1))}
            style={{ background: 'none', border: 'none', color: T.primary, fontSize: 22, cursor: 'pointer' }}
          >
            +
          </button>
        </div>

        {erro && <p style={{ color: T.danger, fontSize: 13, margin: '0 0 12px' }}>{erro}</p>}

        <Btn full disabled={precoCents <= 0 || salvando} onClick={() => void confirmar()}>
          {salvando
            ? 'Salvando…'
            : `✓ Riscar${precoCents > 0 ? ` · ${formatBRL(precoCents * qty)}` : ''}`}
        </Btn>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: T.muted,
            fontSize: 13,
            padding: '14px 0 0',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>,
    document.body,
  );
}

function QtyBtn({
  label,
  onClick,
  color,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        width: 32,
        height: 32,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        color: color ?? T.text,
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}

function LimiteEditor({
  limiteCents,
  onChange,
}: {
  limiteCents: number | null;
  onChange: (v: number | null) => void;
}) {
  const { T } = useTheme();
  const [editing, setEditing] = useState(false);
  const [cents, setCents] = useState(0);

  function salvar() {
    if (cents <= 0) return;
    onChange(cents);
    setEditing(false);
  }
  function remover() {
    onChange(null);
    setEditing(false);
  }

  const miniBtn = (variant: 'primary' | 'ghost' | 'danger', disabled = false) =>
    ({
      borderRadius: 9,
      padding: '6px 10px',
      fontSize: 12,
      fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...(variant === 'primary'
        ? { background: T.primary, color: '#FFF', border: 'none' }
        : variant === 'danger'
          ? { background: 'none', color: T.danger, border: `1px solid ${T.danger}55` }
          : { background: 'none', color: T.muted, border: `1px solid ${T.border}` }),
    }) as const;

  if (!editing) {
    const temLimite = limiteCents !== null;
    return (
      <button
        onClick={() => {
          setEditing(true);
          setCents(limiteCents ?? 0);
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 5,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <span style={{ color: T.muted, fontSize: 12 }}>Limite</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: temLimite ? T.card : T.primary,
            color: temLimite ? T.text : '#FFF',
            border: temLimite ? `1px solid ${T.border}` : 'none',
            borderRadius: 99,
            padding: '7px 14px',
            fontSize: 14,
            fontWeight: 800,
            boxShadow: temLimite ? 'none' : '0 2px 8px rgba(255,107,43,0.35)',
          }}
        >
          {temLimite ? (
            <>
              {formatBRL(limiteCents)} <span style={{ fontSize: 12 }}>✏️</span>
            </>
          ) : (
            <>+ Definir limite</>
          )}
        </span>
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <span style={{ color: T.muted, fontSize: 12 }}>Limite (R$)</span>
      <CurrencyInput
        autoFocus
        cents={cents}
        onCents={setCents}
        onEnter={salvar}
        style={{ width: 120, textAlign: 'right', padding: '7px 10px' }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        {limiteCents !== null && (
          <button onClick={remover} style={miniBtn('danger')}>
            Remover
          </button>
        )}
        <button onClick={() => setEditing(false)} style={miniBtn('ghost')}>
          Cancelar
        </button>
        <button onClick={salvar} disabled={cents <= 0} style={miniBtn('primary', cents <= 0)}>
          Salvar
        </button>
      </div>
    </div>
  );
}

function AddPanel({
  produtos,
  onAdd,
  onClose,
}: {
  produtos: ProdutoDTO[];
  onAdd: (p: ProdutoDTO, precoCents: number, qty: number) => Promise<void>;
  onClose: () => void;
}) {
  const { T } = useTheme();
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<ProdutoDTO | null>(null);
  const [precoCents, setPrecoCents] = useState(0);
  const [qty, setQty] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanEan, setScanEan] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  async function adicionar() {
    // Preço é OPCIONAL: sem preço = item planejado na lista (o preço vem ao riscar).
    if (!sel || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await onAdd(sel, precoCents, qty);
      // Sucesso: o pai fecha o painel; não precisa reabilitar.
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  /** Cria um produto novo (guardando o EAN, se houver) e o pré-seleciona. */
  async function criarProdutoNovo(nome: string, ean?: string) {
    setCriando(true);
    setErro(null);
    try {
      const eanUsar = ean ?? scanEan ?? undefined;
      const p = await api.criarProduto({
        nome: nome.trim(),
        ...(eanUsar ? { ean: eanUsar } : {}),
      });
      setSel(p);
      setBusca(p.nome);
      setScanEan(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCriando(false);
    }
  }

  /**
   * Recebe o EAN bipado e leva DIRETO ao preço + quantidade. Achou na nossa base →
   * usa (entra no histórico); tem sugestão do OFF → cadastra automaticamente (o
   * usuário não precisa saber disso); só se não houver nome nenhum é que pedimos
   * pra digitar.
   */
  async function aoBipar(ean: string) {
    setErro(null);
    try {
      const r = await api.buscarProdutoPorEan(ean);
      if (r.produto) {
        setSel(r.produto);
        setBusca(r.produto.nome);
        setScanEan(null);
      } else if (r.sugestaoNome) {
        await criarProdutoNovo(r.sugestaoNome, ean); // auto-cadastra → vai pro preço+qtd
      } else {
        // Sem nome em lugar nenhum (raro em embalado): deixa o usuário nomear.
        setSel(null);
        setScanEan(ean);
        setBusca('');
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      // Fecha o scanner só ao terminar — ele mostra o loader até aqui (sem tela morta).
      setScanOpen(false);
    }
  }

  const filtrados = useMemo(
    () =>
      busca.trim().length > 0
        ? produtos.filter((p) => combinaBusca(p.nome, busca)).slice(0, 6)
        : [],
    [busca, produtos],
  );
  const buscaTrim = busca.trim();
  const podeCriar =
    buscaTrim.length >= 2 &&
    !filtrados.some((p) => p.nome.toLowerCase() === buscaTrim.toLowerCase());

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ color: T.text }}>Adicionar item</strong>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: T.muted,
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder="Buscar produto…"
          value={sel ? sel.nome : busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setSel(null);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: `1.5px solid ${T.border}`,
            borderRadius: 12,
            padding: '12px 14px',
            background: T.card,
            color: T.text,
            fontSize: 15,
          }}
        />
        <button
          onClick={() => {
            setErro(null);
            setScanOpen(true);
          }}
          title="Bipar o código de barras"
          style={{
            flexShrink: 0,
            background: T.primaryBg,
            color: T.primary,
            border: 'none',
            borderRadius: 12,
            padding: '0 14px',
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          📷
        </button>
      </div>
      {!sel && erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}
      {!sel && podeCriar && (
        <button
          onClick={() => void criarProdutoNovo(buscaTrim)}
          disabled={criando}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            background: T.primaryBg,
            border: `1px dashed ${T.primary}`,
            borderRadius: 12,
            padding: '10px 12px',
            cursor: 'pointer',
            textAlign: 'left',
            color: T.primary,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          <span style={{ fontSize: 18 }}>＋</span>
          {criando ? 'Criando…' : `Criar "${buscaTrim}"`}
          {scanEan ? ' 📷' : ''}
        </button>
      )}
      {!sel &&
        filtrados.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSel(p);
              setBusca(p.nome);
            }}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: '10px 12px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 20 }}>{emojiDe(p)}</span>
            <span style={{ color: T.text, fontSize: 14 }}>{p.nome}</span>
          </button>
        ))}
      {sel && (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <CurrencyInput
              cents={precoCents}
              onCents={setPrecoCents}
              placeholder="Preço R$"
              style={{ flex: 1 }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: T.card,
                border: `1.5px solid ${T.border}`,
                borderRadius: 12,
                padding: '0 12px',
              }}
            >
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: T.text,
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                −
              </button>
              <span style={{ color: T.text, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => q + 1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: T.primary,
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            </div>
          </div>
          <p style={{ color: T.muted, fontSize: 11, margin: 0 }}>
            💡 Sem preço, o item entra na lista — você risca e informa o valor no mercado.
          </p>
          {erro && (
            <p style={{ color: T.danger, fontSize: 13, margin: 0, textAlign: 'center' }}>{erro}</p>
          )}
          <Btn full disabled={enviando} onClick={() => void adicionar()}>
            {enviando
              ? 'Adicionando…'
              : precoCents > 0
                ? `Adicionar · ${formatBRL(precoCents * qty)}`
                : '＋ Adicionar à lista'}
          </Btn>
        </>
      )}
      {scanOpen && (
        <BarcodeScanner
          onDetectar={(ean) => void aoBipar(ean)}
          onClose={() => setScanOpen(false)}
        />
      )}
    </Card>
  );
}

/** Barra "comprando em X" no topo da compra. Sem mercado → convida a confirmar. */
function MercadoDaCompra({
  cart,
  onCart,
  open,
  setOpen,
}: {
  cart: CartDTO;
  onCart: (c: CartDTO) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { T } = useTheme();
  const [removendo, setRemovendo] = useState(false);
  const m = cart.mercado;

  async function remover() {
    setRemovendo(true);
    try {
      onCart(await api.removerMercadoCarrinho(cart.id));
    } catch {
      /* mantém o mercado atual em caso de erro */
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <>
      {m ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '10px 14px',
          }}
        >
          <span style={{ fontSize: 18 }}>🏪</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: T.muted, fontSize: 11, margin: '0 0 4px' }}>Comprando em</p>
            <MarketTag nome={m.nome} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => setOpen(true)}
              disabled={removendo}
              style={{
                background: 'none',
                border: 'none',
                color: T.primary,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              trocar
            </button>
            <button
              onClick={() => void remover()}
              disabled={removendo}
              style={{
                background: 'none',
                border: 'none',
                color: T.muted,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {removendo ? '…' : 'remover'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            background: T.primaryBg,
            border: `1px dashed ${T.primary}`,
            borderRadius: 14,
            padding: '12px 14px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ flex: 1 }}>
            <span style={{ display: 'block', color: T.text, fontSize: 13, fontWeight: 700 }}>
              ▶️ Iniciar compra
            </span>
            <span style={{ display: 'block', color: T.muted, fontSize: 11, marginTop: 2 }}>
              Confirme o mercado por GPS e comece a riscar a lista 🧡
            </span>
          </div>
          <span style={{ color: T.primary, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>
            Iniciar
          </span>
        </button>
      )}
      {open && (
        <MercadoSheet
          cartId={cart.id}
          onClose={() => setOpen(false)}
          onCart={(c) => {
            onCart(c);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** Confirma o mercado da compra por geolocalização (ou digitando). */
function MercadoSheet({
  cartId,
  onClose,
  onCart,
}: {
  cartId: string;
  onClose: () => void;
  onCart: (c: CartDTO) => void;
}) {
  const { T } = useTheme();
  const [nearby, setNearby] = useState<MercadoDTO[] | null>(null);
  const [localizando, setLocalizando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) {
      setErro('Geolocalização não suportada — digite o mercado abaixo.');
      setLocalizando(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api
          .mercadosProximos(pos.coords.latitude, pos.coords.longitude, 3000)
          .then((m) => setNearby(m.slice(0, 10)))
          .catch(() => setNearby([]))
          .finally(() => setLocalizando(false));
      },
      () => {
        setErro('Não consegui sua localização — digite o mercado abaixo.');
        setLocalizando(false);
      },
      // maximumAge reaproveita uma posição recente (bem mais rápido em nova abertura);
      // timeout maior evita o "às vezes não carrega" quando o GPS demora a responder.
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, []);

  async function definir(mercado: CartMercadoDTO) {
    setSalvando(true);
    setErro(null);
    try {
      onCart(await api.definirMercadoCarrinho(cartId, mercado));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  const doMercado = (m: MercadoDTO): CartMercadoDTO => ({
    id: m.id,
    nome: m.nome,
    ...(m.endereco ? { endereco: m.endereco } : {}),
    lat: m.localizacao.lat,
    lng: m.localizacao.lng,
  });

  const lista = nearby ?? [];
  const itemBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: '11px 12px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    color: T.text,
    fontSize: 14,
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: T.surface,
          borderRadius: '24px 24px 0 0',
          padding: '18px 20px calc(24px + env(safe-area-inset-bottom))',
          maxHeight: '86vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: T.border,
            borderRadius: 99,
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: T.text, fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>
          Onde você está comprando?
        </p>
        <p style={{ color: T.muted, fontSize: 12, margin: '0 0 14px', lineHeight: 1.5 }}>
          Confirmando o mercado, cada preço que você digitar no carrinho já entra na base
          colaborativa — sem redigitar.
        </p>

        {localizando && (
          <CartLoader label="Localizando você e buscando mercados por perto…" size={72} />
        )}

        {!localizando && nearby !== null && nearby.length === 0 && (
          <p style={{ color: T.muted, fontSize: 13, margin: '4px 0 14px' }}>
            Não encontrei mercados aqui perto — digite o nome do mercado abaixo.
          </p>
        )}

        {lista[0] && (
          <div
            style={{
              background: T.primaryBg,
              border: `1px solid ${T.primary}55`,
              borderRadius: 14,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <p style={{ color: T.muted, fontSize: 12, margin: '0 0 2px' }}>O mais próximo é</p>
            <p style={{ color: T.text, fontSize: 16, fontWeight: 800, margin: '0 0 10px' }}>
              {lista[0].nome}
            </p>
            <Btn full disabled={salvando} onClick={() => void definir(doMercado(lista[0]!))}>
              {salvando ? 'Salvando…' : '✓ Sim, é aqui'}
            </Btn>
          </div>
        )}

        {lista.length > 1 && (
          <>
            <SLabel>Outro mercado perto</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {lista.slice(1).map((m) => (
                <button
                  key={m.id}
                  disabled={salvando}
                  onClick={() => void definir(doMercado(m))}
                  style={itemBtn}
                >
                  <span style={{ fontSize: 18 }}>🏬</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{m.nome}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <SLabel>Ou digite o nome</SLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Nome do mercado"
            style={{
              flex: 1,
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              padding: '11px 14px',
              background: T.card,
              color: T.text,
              fontSize: 15,
            }}
          />
          <Btn
            small
            disabled={salvando || manual.trim().length < 2}
            onClick={() =>
              void definir({
                id: `manual:${manual.trim().toLowerCase().replace(/\s+/g, '-')}`,
                nome: manual.trim(),
              })
            }
          >
            Usar
          </Btn>
        </div>

        {erro && <p style={{ color: T.danger, fontSize: 13, margin: '12px 0 0' }}>{erro}</p>}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: T.muted,
            fontSize: 13,
            padding: '14px 0 0',
            cursor: 'pointer',
          }}
        >
          Agora não
        </button>
      </div>
    </div>,
    document.body,
  );
}
