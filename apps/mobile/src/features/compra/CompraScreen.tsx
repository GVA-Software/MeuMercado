import { useEffect, useMemo, useState } from 'react';
import type { CartDTO, ProdutoDTO } from '@meumercado/contracts';
import { api, formatBRL } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { AppLogo, Btn, Card, CurrencyInput, EmptyState, SLabel, ThemeToggle } from '../../ui/kit';

export function CompraScreen() {
  const { T } = useTheme();
  const [cart, setCart] = useState<CartDTO | null>(null);
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
        setError(e instanceof Error ? e.message : String(e));
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
      unitPriceCents: precoCents,
      quantity: qty,
      ...(p.emoji !== undefined ? { emoji: p.emoji } : {}),
    });
    setCart(updated);
    setAddOpen(false);
  }

  async function mudarQtd(lineId: string, novo: number) {
    if (!cart) return;
    setCart(
      novo < 1
        ? await api.removerItem(cart.id, lineId)
        : await api.alterarQuantidade(cart.id, lineId, novo),
    );
  }

  async function definirLimite(valor: number | null) {
    if (!cart) return;
    setCart(await api.definirLimite(cart.id, valor));
  }

  if (error) {
    return (
      <div style={{ padding: 20, paddingBottom: 100 }}>
        <EmptyState emoji="⚠️" titulo="Não consegui falar com a API" sub={error} />
        <p style={{ color: T.muted, fontSize: 13, textAlign: 'center' }}>
          Rode a API: <code>pnpm --filter @meumercado/api dev</code>
        </p>
      </div>
    );
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
        {addOpen && (
          <AddPanel produtos={produtos} onAdd={adicionar} onClose={() => setAddOpen(false)} />
        )}

        {cart && cart.items.length === 0 && !addOpen ? (
          <Card>
            <EmptyState emoji="🛒" titulo="Carrinho vazio" sub="Toque em + para adicionar itens." />
            <div style={{ textAlign: 'center' }}>
              <Btn small onClick={() => setAddOpen(true)}>
                Adicionar primeiro item
              </Btn>
            </div>
          </Card>
        ) : (
          cart &&
          cart.items.length > 0 && (
            <>
              <SLabel>
                {cart.items.length} {cart.items.length === 1 ? 'item' : 'itens'}
              </SLabel>
              {cart.items.map((item) => (
                <div
                  key={item.lineId}
                  style={{
                    background: T.surface,
                    borderRadius: 16,
                    padding: 13,
                    border: `1px solid ${T.border}`,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    boxShadow: `0 1px 4px ${T.shadow}`,
                  }}
                >
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
                    }}
                  >
                    {item.emoji ?? '📦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        color: T.text,
                        fontSize: 14,
                        fontWeight: 700,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.nome}
                    </p>
                    <p
                      style={{ color: T.primary, fontSize: 13, fontWeight: 600, margin: '2px 0 0' }}
                    >
                      {formatBRL(item.unitPrice.cents)} × {item.quantity} ={' '}
                      {formatBRL(item.subtotal.cents)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <QtyBtn
                      label="−"
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
                      onClick={() => void mudarQtd(item.lineId, item.quantity + 1)}
                    />
                  </div>
                  <button
                    onClick={() => void api.removerItem(cart.id, item.lineId).then(setCart)}
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
                </div>
              ))}
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
                  Total do carrinho
                </span>
                <span style={{ color: T.primary, fontWeight: 800, fontSize: 20 }}>
                  {formatBRL(cart.total.cents)}
                </span>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

function QtyBtn({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  const { T } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        width: 27,
        height: 27,
        cursor: 'pointer',
        color: color ?? T.text,
        fontSize: 15,
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
    onChange(cents > 0 ? cents : null);
    setEditing(false);
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <span style={{ color: T.muted, fontSize: 12 }}>Limite (R$)</span>
      <CurrencyInput
        autoFocus
        cents={cents}
        onCents={setCents}
        onBlur={salvar}
        onEnter={salvar}
        style={{ width: 110, textAlign: 'right', padding: '6px 10px' }}
      />
    </div>
  );
}

function AddPanel({
  produtos,
  onAdd,
  onClose,
}: {
  produtos: ProdutoDTO[];
  onAdd: (p: ProdutoDTO, precoCents: number, qty: number) => void;
  onClose: () => void;
}) {
  const { T } = useTheme();
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<ProdutoDTO | null>(null);
  const [precoCents, setPrecoCents] = useState(0);
  const [qty, setQty] = useState(1);

  const filtrados = useMemo(
    () =>
      busca.length > 0
        ? produtos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 6)
        : [],
    [busca, produtos],
  );

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
      <input
        placeholder="Buscar produto…"
        value={sel ? sel.nome : busca}
        onChange={(e) => {
          setBusca(e.target.value);
          setSel(null);
        }}
        style={{
          border: `1.5px solid ${T.border}`,
          borderRadius: 12,
          padding: '12px 14px',
          background: T.card,
          color: T.text,
          fontSize: 15,
        }}
      />
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
            <span style={{ fontSize: 20 }}>{p.emoji ?? '📦'}</span>
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
          <Btn full disabled={precoCents <= 0} onClick={() => onAdd(sel, precoCents, qty)}>
            Adicionar {precoCents > 0 ? formatBRL(precoCents * qty) : ''}
          </Btn>
        </>
      )}
    </Card>
  );
}
