import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  MercadoDTO,
  MercadoResumoDTO,
  PriceHistoryDTO,
  PriceHistoryPointDTO,
  PriceTableRowDTO,
  ProdutoDTO,
  TrendDTO,
} from '@meumercado/contracts';
import { combinaBusca } from '@meumercado/domain';
import { api, formatBRL } from '../../api/client';
import { useTheme, type Theme } from '../../theme/theme';
import { AppLogo, Btn, CartLoader, CurrencyInput, EmptyState, SLabel } from '../../ui/kit';
import { MarketTag, marcaMercado } from '../../ui/market';
import { emojiDe } from '../../ui/emoji';
import { useNav } from '../../app/nav';
import { getRecentMarkets, pushRecentMarket } from './recentMarkets';
import { useAuth } from '../../auth/AuthContext';
import { NfceFlow } from '../nfce/NfceFlow';

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function PrecosScreen({
  registrarReq,
  onConsumeRegistro,
}: {
  /** Deep-link: abre o registro de preço. Com `produtoId`, pré-seleciona o
   * produto (Nina); `{}` abre em branco (onboarding); `null` = nada. */
  registrarReq?: { produtoId?: string } | null;
  onConsumeRegistro?: () => void;
} = {}) {
  const { T } = useTheme();
  const [rows, setRows] = useState<PriceTableRowDTO[] | null>(null);
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'populares' | 'menor' | 'maior' | 'az'>('populares');
  const [visiveis, setVisiveis] = useState(20);
  const [entry, setEntry] = useState<{ open: boolean; produto?: ProdutoDTO }>({ open: false });
  const [detalhe, setDetalhe] = useState<PriceTableRowDTO | null>(null);
  const [nfceOpen, setNfceOpen] = useState(false);
  const [mercadoFiltro, setMercadoFiltro] = useState<string | null>(null);
  const [mercadosDisp, setMercadosDisp] = useState<MercadoResumoDTO[]>([]);

  const carregar = useCallback(async () => {
    try {
      setRows(await api.tabelaPrecos(mercadoFiltro ?? undefined));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [mercadoFiltro]);

  const carregarMercados = useCallback(() => {
    void api
      .mercadosPreco()
      .then(setMercadosDisp)
      .catch(() => {});
  }, []);

  // Recarrega a tabela sempre que o filtro de mercado muda.
  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    carregarMercados();
    void api
      .listarProdutos()
      .then(setProdutos)
      .catch(() => {});
  }, [carregarMercados]);

  const filtradas = useMemo(() => {
    if (!rows) return null;
    const t = busca.trim();
    // Mesma busca tolerante do back (acento + abreviação): "Pão" acha "PAO FRANCES".
    const base = t ? rows.filter((r) => combinaBusca(r.produto.nome, t)) : rows;
    const arr = [...base];
    if (ordem === 'menor')
      arr.sort((a, b) => (a.mediaCents ?? Infinity) - (b.mediaCents ?? Infinity));
    else if (ordem === 'maior') arr.sort((a, b) => (b.mediaCents ?? -1) - (a.mediaCents ?? -1));
    else if (ordem === 'az')
      arr.sort((a, b) => a.produto.nome.localeCompare(b.produto.nome, 'pt-BR'));
    // 'populares' = já vem por nº de reportes (backend)
    return arr;
  }, [rows, busca, ordem]);

  // Volta pro topo da paginação quando muda a busca/ordem.
  useEffect(() => {
    setVisiveis(20);
  }, [busca, ordem]);

  function abrirCadastro(produto?: ProdutoDTO) {
    setDetalhe(null);
    setEntry({ open: true, ...(produto ? { produto } : {}) });
  }

  // Deep-link (Nina/onboarding): abre o registro, pré-selecionando o produto se
  // pedido. Espera os produtos carregarem; consome pra não reabrir sozinho depois.
  useEffect(() => {
    if (!registrarReq) return;
    if (registrarReq.produtoId) {
      const alvo = produtos.find((p) => p.id === registrarReq.produtoId);
      if (alvo) {
        abrirCadastro(alvo);
        onConsumeRegistro?.();
      } else if (produtos.length > 0) {
        abrirCadastro(); // carregou mas não achou → abre a busca de produto
        onConsumeRegistro?.();
      }
    } else {
      abrirCadastro(); // registro em branco (onboarding)
      onConsumeRegistro?.();
    }
  }, [registrarReq, produtos, onConsumeRegistro]);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: T.surface,
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <AppLogo size={16} />
        <p style={{ color: T.text, fontSize: 20, fontWeight: 800, margin: '12px 0 2px' }}>Preços</p>
        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
          Preços colaborativos e histórico dos mercados
        </p>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn full onClick={() => abrirCadastro()}>
            ＋ Registrar preço
          </Btn>
          <Btn full variant="soft" onClick={() => setNfceOpen(true)}>
            📷 Ler nota
          </Btn>
        </div>

        {erro && <EmptyState emoji="⚠️" titulo="Não consegui carregar" sub={erro} />}

        {rows && rows.length > 0 && (
          <input
            placeholder="Buscar produto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              padding: '11px 14px',
              background: T.card,
              color: T.text,
              fontSize: 15,
            }}
          />
        )}

        {rows && rows.length > 0 && (
          <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {(
              [
                ['populares', 'Populares'],
                ['menor', 'Menor preço'],
                ['maior', 'Maior preço'],
                ['az', 'A→Z'],
              ] as const
            ).map(([k, label]) => {
              const sel = ordem === k;
              return (
                <button
                  key={k}
                  onClick={() => setOrdem(k)}
                  style={{
                    flexShrink: 0,
                    background: sel ? T.primaryBg : T.card,
                    color: sel ? T.primary : T.sub,
                    border: `1px solid ${sel ? T.primary : T.border}`,
                    borderRadius: 99,
                    padding: '7px 13px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {mercadosDisp.length > 0 && (
          <select
            value={mercadoFiltro ?? ''}
            onChange={(e) => setMercadoFiltro(e.target.value || null)}
            style={{
              width: '100%',
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              padding: '11px 14px',
              background: T.card,
              color: T.text,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="">🏪 Todos os mercados</option>
            {[...mercadosDisp]
              .sort((a, b) =>
                marcaMercado(a.nome).label.localeCompare(marcaMercado(b.nome).label, 'pt-BR'),
              )
              .map((m) => (
                <option key={m.nome} value={m.nome}>
                  {marcaMercado(m.nome).label} · {m.count}
                </option>
              ))}
          </select>
        )}

        {!erro && rows === null && <CartLoader label="Carregando preços…" />}

        {rows && rows.length === 0 && mercadoFiltro && (
          <EmptyState
            emoji="🔍"
            titulo="Nenhum preço nesse mercado"
            sub={`Não há preços reportados em ${marcaMercado(mercadoFiltro).label}. Toque em “Todos” para ver a base completa.`}
          />
        )}

        {rows && rows.length === 0 && !mercadoFiltro && (
          <EmptyState
            emoji="🏷️"
            titulo="Nenhum preço ainda"
            sub="Seja o primeiro a registrar um preço. Assim que houver dados, a Nina começa a comparar e avisar as melhores ofertas."
          />
        )}

        {filtradas && filtradas.length > 0 && (
          <>
            <SLabel>
              {filtradas.length} {filtradas.length === 1 ? 'produto' : 'produtos'}
            </SLabel>
            {filtradas.slice(0, visiveis).map((r) => (
              <TabelaRow key={r.produto.id} row={r} onClick={() => setDetalhe(r)} />
            ))}
            {filtradas.length > visiveis && (
              <Btn full variant="ghost" onClick={() => setVisiveis((v) => v + 20)}>
                Mostrar mais {Math.min(20, filtradas.length - visiveis)} de {filtradas.length}
              </Btn>
            )}
          </>
        )}
      </div>

      {entry.open && (
        <PriceEntrySheet
          produtos={produtos}
          {...(entry.produto ? { preselect: entry.produto } : {})}
          onClose={() => setEntry({ open: false })}
          onDone={() => {
            setEntry({ open: false });
            void carregar();
            carregarMercados();
          }}
        />
      )}

      {detalhe && (
        <DetailSheet
          row={detalhe}
          onClose={() => setDetalhe(null)}
          onRegistrar={(p) => abrirCadastro(p)}
          onMerged={() => {
            setDetalhe(null);
            void carregar();
            carregarMercados();
          }}
        />
      )}

      {nfceOpen && (
        <NfceFlow
          onClose={() => setNfceOpen(false)}
          onImported={() => {
            void carregar();
            carregarMercados();
          }}
        />
      )}
    </div>
  );
}

function TrendBadge({ trend, pct }: { trend: TrendDTO | null; pct: number | null }) {
  const { T } = useTheme();
  if (!trend) return null;
  const cfg: Record<TrendDTO, { color: string; label: string }> = {
    subiu: { color: T.danger, label: `▲ +${Math.round(pct ?? 0)}%` },
    caiu: { color: T.green, label: `▼ ${Math.round(pct ?? 0)}%` },
    estavel: { color: T.muted, label: '— estável' },
  };
  const c = cfg[trend];
  return (
    <span
      style={{
        background: `${c.color}1e`,
        color: c.color,
        fontSize: 11,
        fontWeight: 800,
        padding: '3px 8px',
        borderRadius: 99,
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}

function TabelaRow({ row, onClick }: { row: PriceTableRowDTO; onClick: () => void }) {
  const { T } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: '12px 14px',
        cursor: 'pointer',
        textAlign: 'left',
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
        {emojiDe(row.produto)}
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
          {row.produto.nome}
        </p>
        <p style={{ color: T.muted, fontSize: 12, margin: '2px 0 5px' }}>
          {row.amostras} {row.amostras === 1 ? 'preço' : 'preços'}
          {row.menorPrecoMercado ? ' · menor em' : ''}
        </p>
        {row.menorPrecoMercado && <MarketTag nome={row.menorPrecoMercado} />}
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ color: T.text, fontSize: 15, fontWeight: 800, margin: 0 }}>
          {row.mediaCents !== null ? formatBRL(row.mediaCents) : '—'}
        </p>
        <div style={{ marginTop: 3 }}>
          <TrendBadge trend={row.trend} pct={row.trendPct} />
        </div>
      </div>
    </button>
  );
}

/** Gráfico de linha (SVG) da evolução do preço, com área de plotagem e grade. */
function Sparkline({ pontos, color }: { pontos: PriceHistoryPointDTO[]; color: string }) {
  const { T } = useTheme();
  const W = 320;
  const H = 132;
  const padX = 14;
  const padTop = 16;
  const padBottom = 22;
  if (pontos.length === 0) return null;

  const vals = pontos.map((p) => p.priceCents);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = pontos.length;
  const plotH = H - padTop - padBottom;
  const coords = pontos.map((p, i) => {
    const x = n === 1 ? W / 2 : padX + (i / (n - 1)) * (W - 2 * padX);
    const y = padTop + (1 - (p.priceCents - min) / span) * plotH;
    return [x, y] as const;
  });
  const linha = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const base = padTop + plotH;
  const area = `${coords[0]![0].toFixed(1)},${base} ${linha} ${coords[n - 1]![0].toFixed(1)},${base}`;
  // Linhas de grade horizontais (4 faixas).
  const grades = [0, 0.25, 0.5, 0.75, 1].map((f) => padTop + f * plotH);

  return (
    <div
      style={{
        background: T.card,
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        padding: '8px 10px 4px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: T.muted, fontSize: 10, fontWeight: 700 }}>máx {formatBRL(max)}</span>
        <span style={{ color: T.muted, fontSize: 10, fontWeight: 700 }}>mín {formatBRL(min)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {grades.map((y, i) => (
          <line
            key={i}
            x1={padX}
            y1={y}
            x2={W - padX}
            y2={y}
            stroke={T.border}
            strokeWidth={1}
            strokeDasharray="2 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon points={area} fill={`${color}22`} stroke="none" />
        {n > 1 && (
          <polyline
            points={linha}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.2} fill={color} stroke={T.card} strokeWidth={1.5} />
        ))}
      </svg>
    </div>
  );
}

function StatChip({ label, valorCents }: { label: string; valorCents: number | null }) {
  const { T } = useTheme();
  return (
    <div
      style={{
        flex: 1,
        background: T.card,
        borderRadius: 12,
        padding: '10px 12px',
        textAlign: 'center',
      }}
    >
      <p style={{ color: T.muted, fontSize: 11, margin: '0 0 3px', fontWeight: 700 }}>{label}</p>
      <p style={{ color: T.text, fontSize: 15, fontWeight: 800, margin: 0 }}>
        {valorCents !== null ? formatBRL(valorCents) : '—'}
      </p>
    </div>
  );
}

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const { T } = useTheme();
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
          padding: '18px 20px calc(28px + env(safe-area-inset-bottom))',
          maxHeight: '88vh',
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
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DetailSheet({
  row,
  onClose,
  onRegistrar,
  onMerged,
}: {
  row: PriceTableRowDTO;
  onClose: () => void;
  onRegistrar: (p: ProdutoDTO) => void;
  onMerged: () => void;
}) {
  const { T }: { T: Theme } = useTheme();
  const { irParaMapa } = useNav();
  const { user } = useAuth();
  const [hist, setHist] = useState<PriceHistoryDTO | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeBusca, setMergeBusca] = useState('');
  const [mergeResult, setMergeResult] = useState<ProdutoDTO[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeErro, setMergeErro] = useState<string | null>(null);

  useEffect(() => {
    void api
      .historicoPreco(row.produto.id)
      .then(setHist)
      .catch(() => setHist({ produtoId: row.produto.id, pontos: [] }));
  }, [row.produto.id]);

  useEffect(() => {
    const t = mergeBusca.trim();
    if (t.length < 2) {
      setMergeResult([]);
      return;
    }
    let vivo = true;
    void api
      .buscarProdutos(t)
      .then((r) => {
        if (vivo) setMergeResult(r.filter((p) => p.id !== row.produto.id).slice(0, 6));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [mergeBusca, row.produto.id]);

  async function juntar(outro: ProdutoDTO) {
    if (
      !window.confirm(
        `Juntar "${outro.nome}" em "${row.produto.nome}"? Os preços serão unidos e "${outro.nome}" deixa de existir.`,
      )
    )
      return;
    setMerging(true);
    setMergeErro(null);
    try {
      // Move os preços do produto escolhido para ESTE (que fica).
      await api.juntarProduto(outro.id, row.produto.id);
      onMerged();
    } catch (e) {
      setMergeErro(e instanceof Error ? e.message : String(e));
      setMerging(false);
    }
  }

  const recentes = hist ? [...hist.pontos].reverse().slice(0, 8) : [];

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: T.primaryBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
          }}
        >
          {emojiDe(row.produto)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: T.text, fontSize: 17, fontWeight: 800, margin: 0 }}>
            {row.produto.nome}
          </p>
          <p style={{ color: T.muted, fontSize: 13, margin: '2px 0 0' }}>
            {row.amostras} {row.amostras === 1 ? 'preço reportado' : 'preços reportados'}
          </p>
        </div>
        <TrendBadge trend={row.trend} pct={row.trendPct} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <StatChip label="MENOR" valorCents={row.minCents} />
        <StatChip label="MÉDIA" valorCents={row.mediaCents} />
        <StatChip label="MAIOR" valorCents={row.maxCents} />
      </div>

      <SLabel>Evolução do preço</SLabel>
      {hist === null ? (
        <p style={{ color: T.muted, fontSize: 13 }}>Carregando…</p>
      ) : hist.pontos.length < 2 ? (
        <p style={{ color: T.muted, fontSize: 13, margin: '0 0 14px' }}>
          Poucos dados ainda — registre mais preços para ver a tendência no gráfico.
        </p>
      ) : (
        <div style={{ margin: '4px 0 16px' }}>
          <Sparkline pontos={hist.pontos} color={T.primary} />
        </div>
      )}

      {recentes.length > 0 && (
        <>
          <SLabel>Reportes recentes</SLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {recentes.map((p, i) => (
              <div key={i} style={{ background: T.card, borderRadius: 10, padding: '10px 12px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {p.mercadoNome ? (
                    <MarketTag nome={p.mercadoNome} />
                  ) : (
                    <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>Mercado</span>
                  )}
                  <span style={{ color: T.primary, fontSize: 14, fontWeight: 800 }}>
                    {formatBRL(p.priceCents)}
                  </span>
                </div>
                {p.mercadoEndereco && (
                  <p style={{ color: T.muted, fontSize: 11, margin: '6px 0 0', lineHeight: 1.4 }}>
                    📍 {p.mercadoEndereco}
                  </p>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 6,
                  }}
                >
                  <span style={{ color: T.muted, fontSize: 11 }}>{fmtData(p.observedAt)}</span>
                  {p.mercadoLat !== null && p.mercadoLng !== null && (
                    <button
                      onClick={() =>
                        irParaMapa({
                          lat: p.mercadoLat!,
                          lng: p.mercadoLng!,
                          nome: p.mercadoNome ?? 'Mercado',
                          ...(p.mercadoEndereco ? { endereco: p.mercadoEndereco } : {}),
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: T.primary,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      🗺️ Ver no mapa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Btn full onClick={() => onRegistrar(row.produto)}>
        ＋ Registrar preço deste produto
      </Btn>

      {user?.isAdmin && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          {!mergeOpen ? (
            <button
              onClick={() => setMergeOpen(true)}
              style={{
                width: '100%',
                background: 'none',
                border: `1px dashed ${T.border}`,
                borderRadius: 12,
                padding: '10px 12px',
                color: T.muted,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔗 É o mesmo que outro produto? Juntar
            </button>
          ) : (
            <div>
              <p style={{ color: T.muted, fontSize: 12, margin: '0 0 8px', lineHeight: 1.5 }}>
                Busque o produto duplicado — os preços dele entram em{' '}
                <strong style={{ color: T.text }}>{row.produto.nome}</strong> e ele some.
              </p>
              <input
                autoFocus
                placeholder="Buscar produto para juntar…"
                value={mergeBusca}
                onChange={(e) => setMergeBusca(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 12,
                  padding: '11px 14px',
                  background: T.card,
                  color: T.text,
                  fontSize: 15,
                  marginBottom: 8,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mergeResult.map((p) => (
                  <button
                    key={p.id}
                    disabled={merging}
                    onClick={() => void juntar(p)}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      background: T.card,
                      border: `1px solid ${T.border}`,
                      borderRadius: 12,
                      padding: '10px 12px',
                      cursor: merging ? 'wait' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{emojiDe(p)}</span>
                    <span style={{ color: T.text, fontSize: 14, flex: 1 }}>{p.nome}</span>
                    <span style={{ color: T.primary, fontSize: 12, fontWeight: 700 }}>
                      juntar ›
                    </span>
                  </button>
                ))}
              </div>
              {mergeErro && (
                <p style={{ color: T.danger, fontSize: 12, margin: '8px 0 0' }}>{mergeErro}</p>
              )}
              <button
                onClick={() => {
                  setMergeOpen(false);
                  setMergeBusca('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: T.muted,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '10px 0 0',
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function PriceEntrySheet({
  produtos,
  preselect,
  onClose,
  onDone,
}: {
  produtos: ProdutoDTO[];
  preselect?: ProdutoDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const { T } = useTheme();
  const [produto, setProduto] = useState<ProdutoDTO | null>(preselect ?? null);
  const [buscaProd, setBuscaProd] = useState('');
  const [criando, setCriando] = useState(false);
  const [mercadoNome, setMercadoNome] = useState('');
  const [mercadoId, setMercadoId] = useState<string | null>(null);
  const [mercadoDados, setMercadoDados] = useState<{
    endereco?: string;
    lat?: number;
    lng?: number;
  }>({});
  const [nearby, setNearby] = useState<MercadoDTO[] | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [precoCents, setPrecoCents] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recentes] = useState(getRecentMarkets);

  function escolherMercado(m: {
    id: string | null;
    nome: string;
    endereco?: string;
    lat?: number;
    lng?: number;
  }) {
    setMercadoNome(m.nome);
    setMercadoId(m.id);
    setMercadoDados({
      ...(m.endereco ? { endereco: m.endereco } : {}),
      ...(m.lat !== undefined ? { lat: m.lat } : {}),
      ...(m.lng !== undefined ? { lng: m.lng } : {}),
    });
    setNearby(null);
  }

  const filtrados = useMemo(
    () =>
      buscaProd.trim().length > 0
        ? produtos.filter((p) => p.nome.toLowerCase().includes(buscaProd.toLowerCase())).slice(0, 6)
        : [],
    [buscaProd, produtos],
  );
  const podeEnviar = !!produto && mercadoNome.trim().length > 0 && precoCents > 0 && !enviando;
  const buscaTrim = buscaProd.trim();
  const podeCriar =
    buscaTrim.length >= 2 &&
    !filtrados.some((p) => p.nome.toLowerCase() === buscaTrim.toLowerCase());

  async function criarProdutoNovo() {
    setCriando(true);
    setErro(null);
    try {
      setProduto(await api.criarProduto({ nome: buscaTrim }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCriando(false);
    }
  }

  function buscarPerto() {
    if (!navigator.geolocation) {
      setErro('Geolocalização não suportada.');
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api
          .mercadosProximos(pos.coords.latitude, pos.coords.longitude, 5000)
          .then((m) => setNearby(m.slice(0, 12)))
          .catch(() => setNearby([]))
          .finally(() => setLocalizando(false));
      },
      () => {
        setErro('Não consegui sua localização — digite o mercado manualmente.');
        setLocalizando(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function enviar() {
    if (!produto) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.reportarPreco({
        produtoId: produto.id,
        mercadoId: mercadoId ?? `manual:${slug(mercadoNome) || 'mercado'}`,
        mercadoNome: mercadoNome.trim(),
        ...(mercadoDados.endereco ? { mercadoEndereco: mercadoDados.endereco } : {}),
        ...(mercadoDados.lat !== undefined ? { mercadoLat: mercadoDados.lat } : {}),
        ...(mercadoDados.lng !== undefined ? { mercadoLng: mercadoDados.lng } : {}),
        priceCents: precoCents,
        source: 'manual',
      });
      pushRecentMarket({
        id: mercadoId,
        nome: mercadoNome.trim(),
        ...mercadoDados,
      });
      onDone();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setEnviando(false);
    }
  }

  const inputStyle = {
    border: `1.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    background: T.card,
    color: T.text,
    fontSize: 15,
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ color: T.text, fontSize: 17 }}>Registrar preço</strong>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: T.muted,
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <p style={{ color: T.muted, fontSize: 13, margin: '4px 0 14px' }}>
        Ajude a comunidade: quanto custou e onde. Isso alimenta a Nina.
      </p>

      {/* Produto */}
      <SLabel>Produto</SLabel>
      {produto ? (
        <button
          onClick={() => {
            setProduto(null);
            setBuscaProd('');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            background: T.primaryBg,
            border: `1px solid ${T.primary}55`,
            borderRadius: 12,
            padding: '11px 14px',
            cursor: 'pointer',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 20 }}>{emojiDe(produto)}</span>
          <span
            style={{ color: T.text, fontSize: 14, fontWeight: 700, flex: 1, textAlign: 'left' }}
          >
            {produto.nome}
          </span>
          <span style={{ color: T.primary, fontSize: 12, fontWeight: 700 }}>trocar</span>
        </button>
      ) : (
        <>
          <input
            autoFocus
            placeholder="Buscar produto…"
            value={buscaProd}
            onChange={(e) => setBuscaProd(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {filtrados.map((p) => (
              <button
                key={p.id}
                onClick={() => setProduto(p)}
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
            {podeCriar && (
              <button
                onClick={() => void criarProdutoNovo()}
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
              </button>
            )}
          </div>
        </>
      )}

      {/* Mercado */}
      <SLabel>Mercado</SLabel>
      {recentes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {recentes.map((m) => {
            const sel = mercadoNome.trim().toLowerCase() === m.nome.toLowerCase();
            return (
              <button
                key={m.nome}
                onClick={() => escolherMercado(m)}
                style={{
                  background: sel ? T.primary : T.primaryBg,
                  color: sel ? '#FFF' : T.primary,
                  border: `1px solid ${sel ? T.primary : `${T.primary}44`}`,
                  borderRadius: 99,
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {m.nome}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          placeholder="Nome do mercado"
          value={mercadoNome}
          onChange={(e) => {
            setMercadoNome(e.target.value);
            setMercadoId(null);
            setMercadoDados({});
          }}
          style={inputStyle}
        />
        <button
          onClick={buscarPerto}
          disabled={localizando}
          title="Buscar mercados perto de mim"
          style={{
            flexShrink: 0,
            background: T.primaryBg,
            color: T.primary,
            border: 'none',
            borderRadius: 12,
            padding: '0 14px',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {localizando ? '…' : '📍'}
        </button>
      </div>
      {nearby && nearby.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {nearby.map((m) => (
            <button
              key={m.id}
              onClick={() =>
                escolherMercado({
                  id: m.id,
                  nome: m.nome,
                  ...(m.endereco ? { endereco: m.endereco } : {}),
                  lat: m.localizacao.lat,
                  lng: m.localizacao.lng,
                })
              }
              style={{
                background: mercadoId === m.id ? T.primary : T.card,
                color: mercadoId === m.id ? '#FFF' : T.sub,
                border: `1px solid ${T.border}`,
                borderRadius: 99,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {m.nome}
            </button>
          ))}
        </div>
      )}
      {(!nearby || nearby.length === 0) && <div style={{ height: 6 }} />}

      {/* Preço */}
      <SLabel>Preço (R$)</SLabel>
      <CurrencyInput
        cents={precoCents}
        onCents={setPrecoCents}
        style={{ ...inputStyle, marginBottom: 16 }}
      />

      {erro && <p style={{ color: T.danger, fontSize: 13, margin: '0 0 12px' }}>{erro}</p>}

      <Btn full disabled={!podeEnviar} onClick={() => void enviar()}>
        {enviando ? 'Enviando…' : `Registrar ${precoCents > 0 ? formatBRL(precoCents) : 'preço'}`}
      </Btn>
      <p style={{ color: T.muted, fontSize: 11, textAlign: 'center', margin: '10px 0 0' }}>
        📷 Nota fiscal (QR) e foto do preço chegam em breve.
      </p>
    </BottomSheet>
  );
}
