import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CompraDTO } from '@meumercado/contracts';
import { api, formatBRL, mensagemDeErro } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { AvisoDialog, CartLoader, ConfirmDialog, EmptyState } from '../../ui/kit';
import { MarketTag } from '../../ui/market';
import { emojiDe } from '../../ui/emoji';

/** Rótulo de quantidade: "0,348 kg" (peso), "×2" (unidades) ou "" (1 unidade). */
function qtdLabel(it: { quantity: number; unidade?: string | undefined }): string {
  if (it.unidade && it.unidade !== 'un') {
    return `${it.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${it.unidade}`;
  }
  return it.quantity > 1 ? `×${it.quantity}` : '';
}

function mesLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}
function dataLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function ordDe(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Histórico de compras do usuário: economia, gasto por mês e a lista. */
export function MinhasCompras({ onClose }: { onClose: () => void }) {
  const { T } = useTheme();
  const [compras, setCompras] = useState<CompraDTO[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [mesFiltro, setMesFiltro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<
    { tipo: 'uma'; compra: CompraDTO } | { tipo: 'todas' } | null
  >(null);
  const [excluindo, setExcluindo] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function confirmarExclusao() {
    if (!confirmar) return;
    setExcluindo(true);
    try {
      if (confirmar.tipo === 'todas') {
        await api.excluirTodasCompras();
        setCompras([]);
        setSucesso('Histórico excluído com sucesso');
      } else {
        const id = confirmar.compra.id;
        await api.excluirCompra(id);
        setCompras((cs) => (cs ?? []).filter((c) => c.id !== id));
        setSucesso('Compra excluída com sucesso');
      }
      setConfirmar(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setConfirmar(null);
    } finally {
      setExcluindo(false);
    }
  }

  useEffect(() => {
    void api
      .listarCompras()
      .then((r) => setCompras(r.compras))
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  }, []);

  const resumo = useMemo(() => {
    const lista = compras ?? [];
    const totalGasto = lista.reduce((s, c) => s + c.totalCents, 0);
    const totalEconomia = lista.reduce((s, c) => s + c.economiaCents, 0);
    // Gasto por mês (últimos 6 meses com dados).
    const porMes = new Map<string, { label: string; cents: number; ord: string }>();
    for (const c of lista) {
      const d = new Date(c.criadaEm);
      const ord = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = porMes.get(ord) ?? { label: mesLabel(c.criadaEm), cents: 0, ord };
      cur.cents += c.totalCents;
      porMes.set(ord, cur);
    }
    const meses = [...porMes.values()].sort((a, b) => a.ord.localeCompare(b.ord)).slice(-6);
    return { totalGasto, totalEconomia, meses, n: lista.length };
  }, [compras]);

  const maxMes = Math.max(1, ...resumo.meses.map((m) => m.cents));

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: 'calc(16px + env(safe-area-inset-top)) 16px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Voltar"
          style={{
            background: 'none',
            border: 'none',
            color: T.text,
            fontSize: 22,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ‹
        </button>
        <div>
          <p style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: 0 }}>Minhas compras</p>
          <p style={{ color: T.muted, fontSize: 12, margin: '2px 0 0' }}>Seu histórico de gastos</p>
        </div>
        <div style={{ flex: 1 }} />
        {compras && compras.length > 0 && (
          <button
            onClick={() => setConfirmar({ tipo: 'todas' })}
            style={{
              background: 'none',
              border: `1px solid ${T.border}`,
              color: T.danger,
              borderRadius: 99,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🗑️ Limpar
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {erro && <EmptyState emoji="⚠️" titulo="Não consegui carregar" sub={erro} />}
        {!erro && compras === null && <CartLoader label="Carregando suas compras…" center />}

        {compras && compras.length === 0 && (
          <EmptyState
            emoji="🧾"
            titulo="Nenhuma compra ainda"
            sub="Monte o carrinho, confirme o mercado e toque em Finalizar compra. Elas aparecem aqui com o gasto por mês e a economia."
          />
        )}

        {compras && compras.length > 0 && (
          <>
            {/* Resumo */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  flex: 1,
                  background: T.surface,
                  borderRadius: 14,
                  padding: '14px 12px',
                  textAlign: 'center',
                  border: `1px solid ${T.border}`,
                }}
              >
                <p style={{ color: T.muted, fontSize: 11, fontWeight: 700, margin: '0 0 4px' }}>
                  GASTO TOTAL
                </p>
                <p style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: 0 }}>
                  {formatBRL(resumo.totalGasto)}
                </p>
              </div>
              <div
                style={{
                  flex: 1,
                  background: `${T.green}18`,
                  borderRadius: 14,
                  padding: '14px 12px',
                  textAlign: 'center',
                  border: `1px solid ${T.green}44`,
                }}
              >
                <p style={{ color: T.green, fontSize: 11, fontWeight: 700, margin: '0 0 4px' }}>
                  ABAIXO DA MÉDIA
                </p>
                <p style={{ color: T.green, fontSize: 18, fontWeight: 800, margin: 0 }}>
                  {formatBRL(resumo.totalEconomia)}
                </p>
              </div>
            </div>
            <p style={{ color: T.muted, fontSize: 11, lineHeight: 1.45, margin: '0 0 16px' }}>
              Estimativa: quanto você pagou abaixo da média de preços da comunidade — não é uma
              economia garantida.
            </p>

            {/* Gasto por mês */}
            {resumo.meses.length > 0 && (
              <div
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    color: T.muted,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    margin: '0 0 12px',
                  }}
                >
                  GASTO POR MÊS
                </p>
                <div
                  className="no-scrollbar"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 10,
                    height: 116,
                    overflowX: 'auto',
                  }}
                >
                  {resumo.meses.map((m) => {
                    const sel = mesFiltro === m.ord;
                    return (
                      <button
                        key={m.ord}
                        onClick={() => setMesFiltro((f) => (f === m.ord ? null : m.ord))}
                        style={{
                          flex: '0 0 auto',
                          width: 66,
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            color: sel ? T.primary : T.sub,
                            fontSize: 10,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatBRL(m.cents)}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(6, (m.cents / maxMes) * 74)}px`,
                            background: sel ? T.primary : `${T.primary}88`,
                            border: sel ? `2px solid ${T.primary}` : 'none',
                            borderRadius: '6px 6px 0 0',
                            transition: 'background 0.15s',
                          }}
                        />
                        <span
                          style={{
                            color: sel ? T.text : T.muted,
                            fontSize: 10,
                            fontWeight: sel ? 700 : 400,
                          }}
                        >
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {mesFiltro && (
                  <button
                    onClick={() => setMesFiltro(null)}
                    style={{
                      marginTop: 12,
                      background: T.card,
                      border: `1px solid ${T.border}`,
                      borderRadius: 99,
                      padding: '6px 12px',
                      color: T.primary,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Limpar filtro do mês
                  </button>
                )}
              </div>
            )}

            {/* Lista */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(mesFiltro ? compras.filter((c) => ordDe(c.criadaEm) === mesFiltro) : compras).map(
                (c) => (
                  <div
                    key={c.id}
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: 14,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => setAberta((a) => (a === c.id ? null : c.id))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {c.mercadoNome ? (
                          <MarketTag nome={c.mercadoNome} />
                        ) : (
                          <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>
                            Compra
                          </span>
                        )}
                        <p style={{ color: T.muted, fontSize: 11, margin: '5px 0 0' }}>
                          {dataLabel(c.criadaEm)} · {c.itens.length}{' '}
                          {c.itens.length === 1 ? 'item' : 'itens'}
                          {c.economiaCents > 0
                            ? ` · 💰 ${formatBRL(c.economiaCents)} abaixo da média`
                            : ''}
                        </p>
                      </div>
                      <span style={{ color: T.text, fontSize: 16, fontWeight: 800 }}>
                        {formatBRL(c.totalCents)}
                      </span>
                      <span style={{ color: T.muted, fontSize: 14 }}>
                        {aberta === c.id ? '▲' : '▼'}
                      </span>
                    </button>
                    {aberta === c.id && (
                      <div
                        style={{
                          borderTop: `1px solid ${T.border}`,
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        {c.itens.map((it, i) => (
                          <div
                            key={i}
                            style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}
                          >
                            <span
                              style={{
                                color: T.sub,
                                fontSize: 13,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {emojiDe(it)} {it.nome} {qtdLabel(it)}
                            </span>
                            <span
                              style={{
                                color: T.text,
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatBRL(Math.round(it.unitPriceCents * it.quantity))}
                            </span>
                          </div>
                        ))}
                        <button
                          onClick={() => setConfirmar({ tipo: 'uma', compra: c })}
                          style={{
                            marginTop: 6,
                            alignSelf: 'flex-end',
                            background: 'none',
                            border: `1px solid ${T.danger}44`,
                            color: T.danger,
                            borderRadius: 9,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Excluir esta compra
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </div>

      {confirmar && (
        <ConfirmDialog
          emoji="🗑️"
          perigo
          titulo={confirmar.tipo === 'todas' ? 'Limpar todo o histórico?' : 'Excluir esta compra?'}
          mensagem={
            confirmar.tipo === 'todas'
              ? 'Isso apaga TODAS as suas compras do histórico. Não dá pra desfazer.'
              : 'Essa compra será removida do seu histórico. Não dá pra desfazer.'
          }
          confirmarLabel="Excluir"
          ocupado={excluindo}
          onConfirmar={() => void confirmarExclusao()}
          onCancelar={() => setConfirmar(null)}
        />
      )}

      {sucesso && <AvisoDialog emoji="✅" titulo={sucesso} onOk={() => setSucesso(null)} />}
    </div>,
    document.body,
  );
}
