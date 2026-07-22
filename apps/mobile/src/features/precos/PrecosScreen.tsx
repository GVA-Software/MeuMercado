import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  MercadoDTO,
  MercadoResumoDTO,
  PriceHistoryDTO,
  PriceHistoryPointDTO,
  PriceTableRowDTO,
  ProdutoDTO,
  ProdutoParaCompletarDTO,
  TrendDTO,
} from '@meumercado/contracts';
import { combinaBusca } from '@meumercado/domain';
import { api, formatBRL, mensagemDeErro } from '../../api/client';
import { useTheme, type Theme } from '../../theme/theme';
import {
  AppLogo,
  Btn,
  CartLoader,
  ConfirmDialog,
  CurrencyInput,
  EmptyState,
  SLabel,
} from '../../ui/kit';
import { MARCAS_DISCLAIMER, MarketTag, marcaMercado } from '../../ui/market';
import { emojiDe } from '../../ui/emoji';
import { useNav } from '../../app/nav';
import { getRecentMarkets, pushRecentMarket } from './recentMarkets';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useAuth } from '../../auth/AuthContext';
import { NfceFlow } from '../nfce/NfceFlow';
import { BarcodeScanner } from '../scan/BarcodeScanner';

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** Distância humana: metros abaixo de 1 km, senão km com 1 casa. */
function fmtDist(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Raio (m) usado só pra decidir o vazio "nada perto de você" — não filtra a lista. */
const RAIO_PERTO = 5000;

/**
 * Só afirmamos tendência (subiu/caiu) com amostra mínima — evita "estampar" uma
 * variação de 1-2 reportes como fato (risco de publicidade enganosa).
 */
const MIN_AMOSTRAS_TREND = 3;

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
  const [ordem, setOrdem] = useState<'populares' | 'menor' | 'maior' | 'az' | 'perto'>('populares');
  const { pos, carregando: buscandoLocal, erro: geoErro, pedir: pedirLocal } = useGeolocation();
  // Qual posição as `rows` atuais refletem (para não afirmar "nada perto" antes do refetch).
  const [rowsPos, setRowsPos] = useState<{ lat: number; lng: number } | null>(null);
  const [visiveis, setVisiveis] = useState(20);
  const [entry, setEntry] = useState<{ open: boolean; produto?: ProdutoDTO }>({ open: false });
  const [detalhe, setDetalhe] = useState<PriceTableRowDTO | null>(null);
  const [nfceOpen, setNfceOpen] = useState(false);
  const [mercadoFiltro, setMercadoFiltro] = useState<string | null>(null);
  const [mercadosDisp, setMercadosDisp] = useState<MercadoResumoDTO[]>([]);
  const [categoria, setCategoria] = useState<string>('');
  const [completar, setCompletar] = useState<ProdutoParaCompletarDTO[]>([]);

  const carregar = useCallback(async () => {
    try {
      setRows(await api.tabelaPrecos(mercadoFiltro ?? undefined, pos ?? undefined));
      setRowsPos(pos ?? null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, [mercadoFiltro, pos]);

  const carregarCompletar = useCallback(() => {
    void api
      .produtosParaCompletar()
      .then(setCompletar)
      .catch(() => {});
  }, []);

  const carregarMercados = useCallback(() => {
    void api
      .mercadosPreco()
      .then(setMercadosDisp)
      .catch(() => {});
  }, []);

  // Recarrega a tabela sempre que o filtro de mercado muda. Com flag "vivo": se o
  // usuário troca o filtro rápido, uma resposta lenta antiga não sobrescreve a nova.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const t = await api.tabelaPrecos(mercadoFiltro ?? undefined, pos ?? undefined);
        if (vivo) {
          setRows(t);
          setRowsPos(pos ?? null);
        }
      } catch (e) {
        if (vivo) setErro(mensagemDeErro(e));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [mercadoFiltro, pos]);

  useEffect(() => {
    carregarMercados();
    carregarCompletar();
    void api
      .listarProdutos()
      .then(setProdutos)
      .catch(() => {});
  }, [carregarMercados, carregarCompletar]);

  // Categorias presentes nos preços (pra montar o filtro sem opções vazias).
  const categoriasDisp = useMemo(
    () =>
      [...new Set((rows ?? []).map((r) => r.produto.categoria))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [rows],
  );

  const filtradas = useMemo(() => {
    if (!rows) return null;
    const t = busca.trim();
    // Mesma busca tolerante do back (acento + abreviação): "Pão" acha "PAO FRANCES".
    let base = t ? rows.filter((r) => combinaBusca(r.produto.nome, t)) : rows;
    if (categoria) base = base.filter((r) => r.produto.categoria === categoria);
    const arr = [...base];
    if (ordem === 'menor') arr.sort((a, b) => (a.minCents ?? Infinity) - (b.minCents ?? Infinity));
    else if (ordem === 'maior') arr.sort((a, b) => (b.maxCents ?? -1) - (a.maxCents ?? -1));
    else if (ordem === 'az')
      arr.sort((a, b) => a.produto.nome.localeCompare(b.produto.nome, 'pt-BR'));
    else if (ordem === 'perto')
      // Menor distância entre TODAS as observações (honesto); sem distância vai pro fim.
      arr.sort(
        (a, b) =>
          (a.distanciaMaisProximoMetros ?? Infinity) - (b.distanciaMaisProximoMetros ?? Infinity),
      );
    // 'populares' = já vem por nº de reportes (backend)
    return arr;
  }, [rows, busca, ordem, categoria]);

  // "Perto de mim": pede a localização (gesto). Se negar/sem GPS, o chip fica marcado e o
  // erro (geoErro) é exibido; a lista cai na ordem padrão — nunca trava.
  async function ativarPerto() {
    setOrdem('perto');
    if (!pos) await pedirLocal();
  }

  // As `rows` atuais já refletem a posição atual? (evita afirmar nada antes do refetch geo)
  const rowsGeoAtual = !!pos && !!rowsPos && rowsPos.lat === pos.lat && rowsPos.lng === pos.lng;
  // Concedeu o GPS mas as rows ainda são as SEM distância → buscando (não é "nada perto").
  const atualizandoPerto = ordem === 'perto' && !!pos && !rowsGeoAtual;
  // "Nada perto" SÓ com as rows já buscadas COM a posição — senão o banner piscava falso.
  const nadaPerto =
    ordem === 'perto' &&
    rowsGeoAtual &&
    !!filtradas &&
    filtradas.length > 0 &&
    filtradas.every(
      (r) => r.distanciaMaisProximoMetros === null || r.distanciaMaisProximoMetros > RAIO_PERTO,
    );

  // Volta pro topo da paginação quando muda a busca/ordem/categoria.
  useEffect(() => {
    setVisiveis(20);
  }, [busca, ordem, categoria]);

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
          Preços informados pela comunidade — podem estar desatualizados. Confira na loja.
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

        <CompletarSection itens={completar} onEscolher={(p) => abrirCadastro(p)} />

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
                ['perto', buscandoLocal ? '📍 Localizando…' : '📍 Perto de mim'],
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
                  onClick={() => (k === 'perto' ? void ativarPerto() : setOrdem(k))}
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

        {ordem === 'perto' && !pos && geoErro && (
          <p style={{ color: T.muted, fontSize: 12, margin: 0, lineHeight: 1.4 }}>📍 {geoErro}</p>
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

        {categoriasDisp.length > 1 && (
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            style={{
              width: '100%',
              border: `1.5px solid ${categoria ? T.primary : T.border}`,
              borderRadius: 12,
              padding: '11px 14px',
              background: T.card,
              color: T.text,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="">🏷️ Todas as categorias</option>
            {categoriasDisp.map((c) => (
              <option key={c} value={c}>
                {c}
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

        {rows && rows.length > 0 && filtradas && filtradas.length === 0 && (
          <EmptyState
            emoji="🔍"
            titulo="Nada encontrado"
            sub={
              categoria
                ? `Nenhum produto em ${categoria}${busca.trim() ? ` com "${busca.trim()}"` : ''}. Tente outra categoria.`
                : `Nenhum produto com "${busca.trim()}". Tente outro nome.`
            }
          />
        )}

        {filtradas && filtradas.length > 0 && (
          <>
            {atualizandoPerto && (
              <p style={{ color: T.muted, fontSize: 12.5, margin: 0 }}>
                📍 Buscando os preços perto de você…
              </p>
            )}
            {nadaPerto && (
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  background: T.primaryBg,
                  border: `1px solid ${T.primary}44`,
                  borderRadius: 14,
                  padding: '12px 14px',
                }}
              >
                <span style={{ fontSize: 24 }}>📍</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: T.text, fontSize: 14, fontWeight: 800, margin: 0 }}>
                    Nenhum preço perto de você ainda
                  </p>
                  <p style={{ color: T.sub, fontSize: 12.5, margin: '2px 0 0', lineHeight: 1.4 }}>
                    Seja o primeiro a registrar um preço na sua região. Abaixo, os mais próximos que
                    a comunidade já tem (podem estar longe).
                  </p>
                </div>
              </div>
            )}
            <SLabel>
              {filtradas.length} {filtradas.length === 1 ? 'produto' : 'produtos'}
              {categoria ? ` · ${categoria}` : ''}
            </SLabel>
            {filtradas.slice(0, visiveis).map((r) => (
              <TabelaRow key={r.produto.id} row={r} onClick={() => setDetalhe(r)} />
            ))}
            {filtradas.length > visiveis && (
              <Btn full variant="ghost" onClick={() => setVisiveis((v) => v + 20)}>
                Mostrar mais {Math.min(20, filtradas.length - visiveis)} de {filtradas.length}
              </Btn>
            )}
            <p
              style={{
                color: T.muted,
                fontSize: 11,
                lineHeight: 1.45,
                margin: '8px 4px 0',
                textAlign: 'center',
              }}
            >
              {MARCAS_DISCLAIMER}
            </p>
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
            carregarCompletar();
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
            carregarCompletar();
          }}
        />
      )}

      {nfceOpen && (
        <NfceFlow
          onClose={() => setNfceOpen(false)}
          onImported={() => {
            void carregar();
            carregarMercados();
            carregarCompletar();
          }}
        />
      )}
    </div>
  );
}

/**
 * Mutirão de cobertura: produtos que a comunidade só tem preço em 1 mercado.
 * Um toque abre o registro já com o produto escolhido — o usuário só põe o preço
 * do SEU mercado e o item vira comparável pra todo mundo. É o gargalo nº 1.
 */
function CompletarSection({
  itens,
  onEscolher,
}: {
  itens: ProdutoParaCompletarDTO[];
  onEscolher: (p: ProdutoDTO) => void;
}) {
  const { T } = useTheme();
  const [expandido, setExpandido] = useState(false);
  if (itens.length === 0) return null;
  const mostra = expandido ? itens.slice(0, 20) : itens.slice(0, 4);
  return (
    <div
      style={{
        background: T.primaryBg,
        border: `1px solid ${T.primary}33`,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>🤝</span>
        <strong style={{ color: T.text, fontSize: 15 }}>Complete a comparação</strong>
      </div>
      <p style={{ color: T.muted, fontSize: 12, margin: '0 0 12px', lineHeight: 1.5 }}>
        Estes só têm preço em 1 mercado. Registre quanto custam no seu e a Nina já compara pra todo
        mundo. 🧡
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mostra.map((it) => (
          <button
            key={it.produto.id}
            onClick={() => onEscolher(it.produto)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: '10px 12px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 20 }}>{emojiDe(it.produto)}</span>
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
                {it.produto.nome}
              </p>
              <p
                style={{
                  color: T.muted,
                  fontSize: 12,
                  margin: '2px 0 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatBRL(it.precoCents)}
                {it.mercadoNome ? ` · só em ${marcaMercado(it.mercadoNome).label}` : ''}
              </p>
            </div>
            <span style={{ color: T.primary, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
              ＋ comparar
            </span>
          </button>
        ))}
      </div>
      {itens.length > 4 && (
        <button
          onClick={() => setExpandido((v) => !v)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: T.primary,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '10px 0 0',
          }}
        >
          {expandido ? 'Mostrar menos' : `Ver mais ${itens.length - 4}`}
        </button>
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

/**
 * "Reportar preço incorreto" — canal de correção para o usuário (notice-and-takedown
 * do lado da comunidade). Vai pro MESMO fluxo de feedback que o ADM já lê e responde
 * (com push). O prefixo [Preço incorreto] deixa o reporte fácil de triar.
 */
function ReportarPrecoButton({ produtoNome }: { produtoNome: string }) {
  const { T } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.enviarFeedback('outro', `[Preço incorreto] ${produtoNome} — ${msg.trim()}`);
      setMsg('');
      setAberto(false);
      setOk(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <p style={{ color: T.green, fontSize: 12.5, textAlign: 'center', margin: '10px 0 0' }}>
        🧡 Obrigado! Recebemos o reporte e vamos revisar.
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          color: T.muted,
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          padding: '10px 0 0',
        }}
      >
        🚩 Reportar preço incorreto
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="O que está errado? (ex.: preço, mercado ou produto trocado)"
        rows={3}
        maxLength={2000}
        style={{
          border: `1.5px solid ${T.border}`,
          borderRadius: 12,
          padding: '10px 12px',
          background: T.card,
          color: T.text,
          fontSize: 13.5,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      {erro && <p style={{ color: T.danger, fontSize: 12, margin: 0 }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn full variant="ghost" small onClick={() => setAberto(false)}>
          Cancelar
        </Btn>
        <Btn full small disabled={enviando || msg.trim().length < 3} onClick={() => void enviar()}>
          {enviando ? 'Enviando…' : 'Enviar reporte'}
        </Btn>
      </div>
    </div>
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
        <p style={{ color: T.muted, fontSize: 12, margin: '2px 0 0' }}>
          {row.amostras} {row.amostras === 1 ? 'preço' : 'preços'}
          {row.atualizadoEm ? ` · ${fmtData(row.atualizadoEm)}` : ''}
        </p>
      </div>
      {/* Destaque = MENOR preço + onde (o "achei mais barato" do app), não a média. */}
      <div style={{ textAlign: 'right', minWidth: 0, maxWidth: '46%', flexShrink: 0 }}>
        <p style={{ color: T.text, fontSize: 16, fontWeight: 800, margin: 0 }}>
          {row.minCents !== null
            ? formatBRL(row.minCents)
            : row.mediaCents !== null
              ? formatBRL(row.mediaCents)
              : '—'}
          {row.produto.unidade && row.produto.unidade !== 'un' && (
            <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>
              /{row.produto.unidade}
            </span>
          )}
        </p>
        {row.menorPrecoMercado && (
          <p
            style={{
              color: T.muted,
              fontSize: 11,
              margin: '1px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            🏆 {row.menorPrecoMercado}
            {row.distanciaMetros !== null ? ` · a ${fmtDist(row.distanciaMetros)}` : ''}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            gap: 6,
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginTop: 3,
          }}
        >
          {row.mediaCents !== null && row.minCents !== null && row.mediaCents !== row.minCents && (
            <span style={{ fontSize: 10.5, color: T.muted }}>méd {formatBRL(row.mediaCents)}</span>
          )}
          {row.amostras >= MIN_AMOSTRAS_TREND && (
            <TrendBadge trend={row.trend} pct={row.trendPct} />
          )}
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
  const [confirmarJuntar, setConfirmarJuntar] = useState<ProdutoDTO | null>(null);

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
    setMerging(true);
    setMergeErro(null);
    try {
      // Move os preços do produto escolhido para ESTE (que fica).
      await api.juntarProduto(outro.id, row.produto.id);
      onMerged();
    } catch (e) {
      setMergeErro(mensagemDeErro(e));
      setMerging(false);
      setConfirmarJuntar(null);
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
        {row.amostras >= MIN_AMOSTRAS_TREND && <TrendBadge trend={row.trend} pct={row.trendPct} />}
      </div>

      {/* A resposta que o usuário quer, logo no topo: onde está mais barato + a economia. */}
      {row.minCents !== null && row.menorPrecoMercado && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: T.primaryBg,
            border: `1px solid ${T.primary}44`,
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 24 }}>🏆</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                color: T.muted,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.3,
                margin: 0,
              }}
            >
              MAIS BARATO
            </p>
            <p
              style={{
                color: T.text,
                fontSize: 16,
                fontWeight: 800,
                margin: '1px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {formatBRL(row.minCents)} · {row.menorPrecoMercado}
            </p>
          </div>
          {row.mediaCents !== null && row.mediaCents > row.minCents && (
            <span
              style={{
                flexShrink: 0,
                color: T.primary,
                fontSize: 12,
                fontWeight: 800,
                textAlign: 'right',
              }}
            >
              −{formatBRL(row.mediaCents - row.minCents)}
              <br />
              <span style={{ fontWeight: 600, color: T.muted }}>vs média</span>
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <StatChip label="MENOR" valorCents={row.minCents} />
        <StatChip label="MÉDIA" valorCents={row.mediaCents} />
        <StatChip label="MAIOR" valorCents={row.maxCents} />
      </div>
      <p style={{ color: T.muted, fontSize: 11.5, lineHeight: 1.45, margin: '0 0 14px' }}>
        Valores informados pela comunidade — podem ter mudado e não são o preço oficial da loja.
        Confira no mercado antes de comprar.
      </p>

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

      <ReportarPrecoButton produtoNome={row.produto.nome} />

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
                    onClick={() => setConfirmarJuntar(p)}
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

      {confirmarJuntar && (
        <ConfirmDialog
          emoji="🔗"
          titulo="Juntar produtos?"
          mensagem={`Os preços de "${confirmarJuntar.nome}" entram em "${row.produto.nome}" e "${confirmarJuntar.nome}" deixa de existir. Não dá pra desfazer.`}
          confirmarLabel="Juntar"
          cancelarLabel="Cancelar"
          perigo
          ocupado={merging}
          onConfirmar={() => void juntar(confirmarJuntar)}
          onCancelar={() => setConfirmarJuntar(null)}
        />
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
  // O leitor de código de barras no "Registrar preço" (fluxo colaborativo) é só de
  // admin — evita que qualquer usuário auto-cadastre produtos na base via OFF.
  const { user } = useAuth();
  const [produto, setProduto] = useState<ProdutoDTO | null>(preselect ?? null);
  const [buscaProd, setBuscaProd] = useState('');
  const [criando, setCriando] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanEan, setScanEan] = useState<string | null>(null);
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
  // Ref pra o callback do GPS (assíncrono) saber se o usuário JÁ escolheu um mercado.
  const mercadoNomeRef = useRef(mercadoNome);
  mercadoNomeRef.current = mercadoNome;

  // Ao abrir "Registrar preço", pré-seleciona o mercado por GPS (o mais próximo), como o
  // carrinho já faz — deixando "trocar" fácil (recentes/lista/digitar). Sem GPS/negado →
  // segue no manual, sem travar. maximumAge reusa uma posição recente (bem mais rápido).
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (posGeo) => {
        api
          .mercadosProximos(posGeo.coords.latitude, posGeo.coords.longitude, 3000)
          .then((m) => {
            const lista = m.slice(0, 12);
            setNearby(lista);
            const perto = lista[0];
            // Só pré-seleciona se o usuário ainda NÃO escolheu/digitou um mercado.
            if (perto && !mercadoNomeRef.current.trim()) {
              setMercadoNome(perto.nome);
              setMercadoId(perto.id);
              setMercadoDados({
                ...(perto.endereco ? { endereco: perto.endereco } : {}),
                lat: perto.localizacao.lat,
                lng: perto.localizacao.lng,
              });
            }
          })
          .catch(() => setNearby([]))
          .finally(() => setLocalizando(false));
      },
      () => setLocalizando(false), // negou → segue manual, sem erro ruidoso
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, []);

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
        ? produtos.filter((p) => combinaBusca(p.nome, buscaProd)).slice(0, 6)
        : [],
    [buscaProd, produtos],
  );
  const podeEnviar = !!produto && mercadoNome.trim().length > 0 && precoCents > 0 && !enviando;
  const buscaTrim = buscaProd.trim();
  const podeCriar =
    buscaTrim.length >= 2 &&
    !filtrados.some((p) => p.nome.toLowerCase() === buscaTrim.toLowerCase());

  async function criarProdutoNovo(nome: string = buscaTrim, ean?: string) {
    setCriando(true);
    setErro(null);
    try {
      const eanUsar = ean ?? scanEan ?? undefined;
      const p = await api.criarProduto({ nome: nome.trim(), ...(eanUsar ? { ean: eanUsar } : {}) });
      setProduto(p);
      setScanEan(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCriando(false);
    }
  }

  /** EAN bipado (admin): acha na base, sugere pelo OFF (auto-cadastra) ou deixa nomear. */
  async function aoBipar(ean: string) {
    setErro(null);
    try {
      const r = await api.buscarProdutoPorEan(ean);
      if (r.produto) {
        setProduto(r.produto);
        setScanEan(null);
      } else if (r.sugestaoNome) {
        await criarProdutoNovo(r.sugestaoNome, ean);
      } else {
        setProduto(null);
        setScanEan(ean);
        setBuscaProd('');
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setScanOpen(false);
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              autoFocus
              placeholder="Buscar produto…"
              value={buscaProd}
              onChange={(e) => setBuscaProd(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            {user?.isAdmin && (
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
            )}
          </div>
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
      {localizando && !mercadoNome.trim() && (
        <p style={{ color: T.muted, fontSize: 11.5, margin: '0 0 8px' }}>
          📍 Localizando o mercado mais próximo…
        </p>
      )}
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
        📷 Dica: use “Ler nota” na tela de Preços para importar tudo pelo QR do cupom.
      </p>

      {scanOpen && (
        <BarcodeScanner
          onDetectar={(ean) => void aoBipar(ean)}
          onClose={() => setScanOpen(false)}
        />
      )}
    </BottomSheet>
  );
}
