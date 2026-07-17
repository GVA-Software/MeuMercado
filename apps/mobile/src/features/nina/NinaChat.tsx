import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  CompraDTO,
  InsightDTO,
  OndeComprarResponse,
  ProdutoDTO,
} from '@meumercado/contracts';
import { combinaBusca, interpretar } from '@meumercado/domain';
import { api, formatBRL } from '../../api/client';
import { useNav } from '../../app/nav';
import type { Theme } from '../../theme/theme';
import { emojiDe } from '../../ui/emoji';
import { marcaMercado } from '../../ui/market';

const MEDALHAS = ['🥇', '🥈', '🥉'];

function formatDistancia(m: number | null): string | null {
  if (m === null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

function fmtDataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function fmtDataLonga(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

type CampoHistorico = 'ultima' | 'mais-caro' | 'mais-comprado' | 'gasto' | 'gasto-produto';

/**
 * Monta a resposta sobre o HISTÓRICO PESSOAL de compras — determinístico, a partir
 * das compras do usuário (que a Nina já busca). Nomes de mercado saem bonitos.
 */
function respostaHistorico(
  campo: CampoHistorico,
  produto: string | undefined,
  compras: CompraDTO[],
): string {
  const nomeMercado = (m: string | null) => (m ? ` no ${marcaMercado(m).label}` : '');
  const unidadeDe = (u?: string) => (u && u !== 'un' ? `/${u}` : '');

  if (campo === 'ultima') {
    const c = compras[0]!; // listarCompras vem do mais recente pro mais antigo
    const linhas = c.itens
      .slice(0, 6)
      .map((i) => `• ${i.nome} — ${formatBRL(Math.round(i.unitPriceCents * i.quantity))}`)
      .join('\n');
    const n = c.itens.length;
    const resto = n > 6 ? `\n…e mais ${n - 6} ${n - 6 === 1 ? 'item' : 'itens'}` : '';
    const eco = c.economiaCents > 0 ? ` (${formatBRL(c.economiaCents)} abaixo da média 💰)` : '';
    return `Sua última compra foi em ${fmtDataLonga(c.criadaEm)}${nomeMercado(c.mercadoNome)} — total de ${formatBRL(c.totalCents)}${eco}, ${n} ${n === 1 ? 'item' : 'itens'}:\n${linhas}${resto}`;
  }

  if (campo === 'mais-caro') {
    let top: { i: CompraDTO['itens'][number]; c: CompraDTO } | null = null;
    for (const c of compras)
      for (const i of c.itens)
        if (!top || i.unitPriceCents > top.i.unitPriceCents) top = { i, c };
    if (!top) return 'Ainda não vejo itens nas suas compras registradas.';
    return `O item mais caro que você comprou foi ${top.i.nome}, a ${formatBRL(top.i.unitPriceCents)}${unidadeDe(top.i.unidade)}${nomeMercado(top.c.mercadoNome)} (${fmtDataLonga(top.c.criadaEm)}).`;
  }

  if (campo === 'mais-comprado') {
    const cont = new Map<string, { nome: string; vezes: number; qtd: number }>();
    for (const c of compras)
      for (const i of c.itens) {
        const cur = cont.get(i.nome) ?? { nome: i.nome, vezes: 0, qtd: 0 };
        cur.vezes += 1;
        cur.qtd += i.quantity;
        cont.set(i.nome, cur);
      }
    const top = [...cont.values()].sort((a, b) => b.vezes - a.vezes || b.qtd - a.qtd).slice(0, 3);
    if (top.length === 0) return 'Ainda não vejo itens nas suas compras registradas.';
    const medalhas = ['🥇', '🥈', '🥉'];
    const linhas = top
      .map((x, idx) => `${medalhas[idx]} ${x.nome} — ${x.vezes} ${x.vezes === 1 ? 'vez' : 'vezes'}`)
      .join('\n');
    return `O que você mais comprou:\n${linhas}`;
  }

  if (campo === 'gasto') {
    const total = compras.reduce((s, c) => s + c.totalCents, 0);
    const economia = compras.reduce((s, c) => s + c.economiaCents, 0);
    const eco =
      economia > 0 ? ` — e pagou ${formatBRL(economia)} abaixo da média da comunidade 💰` : '';
    return `Somando suas ${compras.length} ${compras.length === 1 ? 'compra' : 'compras'}, você já gastou ${formatBRL(total)}${eco}.`;
  }

  // gasto-produto: acha o produto nas compras (mais recente primeiro).
  const alvo = produto ?? '';
  for (const c of compras)
    for (const i of c.itens)
      if (combinaBusca(i.nome, alvo)) {
        return `Na sua compra de ${fmtDataLonga(c.criadaEm)}${nomeMercado(c.mercadoNome)}, você pagou ${formatBRL(i.unitPriceCents)}${unidadeDe(i.unidade)} em ${i.nome}.`;
      }
  return `Não achei "${alvo}" nas suas compras registradas. Talvez tenha entrado com outro nome — dá uma olhada na aba Compra. 🙂`;
}

/** Uma mensagem do bate-papo (Nina ou usuário). */
type Msg =
  | { id: number; from: 'nina' | 'user'; kind: 'text'; text: string }
  | {
      id: number;
      from: 'nina';
      kind: 'produtos';
      produtos: ProdutoDTO[];
      raioMetros: number | null;
    }
  | { id: number; from: 'nina'; kind: 'mercados'; resp: OndeComprarResponse }
  | { id: number; from: 'nina'; kind: 'registrar'; produto: ProdutoDTO }
  | { id: number; from: 'nina'; kind: 'insight'; insight: InsightDTO };

// Omit distributivo: preserva cada variante da união (Omit normal colapsa nos
// campos comuns), pra `empurrar` aceitar uma mensagem sem o `id`.
type SemId<T> = T extends unknown ? Omit<T, 'id'> : never;

const SAUDACAO: Msg = {
  id: 0,
  from: 'nina',
  kind: 'text',
  text: 'Oi! Sou a Nina 🧡 Escreva um produto que eu acho onde comprar mais barato perto de você — ou toque em ✨ Meus alertas.',
};

/**
 * Nina em formato de bate-papo (tipo WhatsApp): mensagens de baixo pra cima,
 * campo de envio embaixo. Você escreve um produto → ela mostra os tipos → ranqueia
 * os mercados. Os insights não aparecem sozinhos: viram um botão ("Meus alertas")
 * e a Nina os mostra na conversa quando você pede.
 */
export function NinaChat({ T }: { T: Theme }) {
  const { abrirRegistroPreco } = useNav();
  const [msgs, setMsgs] = useState<Msg[]>([SAUDACAO]);
  const [texto, setTexto] = useState('');
  const [ocupada, setOcupada] = useState(false);
  const [ultimoProduto, setUltimoProduto] = useState<ProdutoDTO | null>(null);
  const idRef = useRef(1);
  const listaRef = useRef<HTMLDivElement>(null);

  const empurrar = (m: SemId<Msg>) =>
    setMsgs((atual) => [...atual, { ...m, id: idRef.current++ } as Msg]);

  useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, ocupada]);

  function posicao(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
  }

  // Entende a mensagem (saudação, agradecimento, ajuda, refino por distância ou
  // busca) e responde no tom certo — a "compreensão" é determinística (domínio).
  function responder(texto: string) {
    const t = texto.trim();
    if (!t || ocupada) return;
    empurrar({ from: 'user', kind: 'text', text: t });
    setTexto('');
    const intent = interpretar(t);
    if (intent.tipo === 'agradecimento') {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Imagina! 🧡 Tô aqui pra te ajudar a economizar. Precisando é só chamar.',
      });
      return;
    }
    if (intent.tipo === 'despedida') {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Até logo! 🧡 Boas compras — e conta comigo pra economizar na próxima.',
      });
      return;
    }
    if (intent.tipo === 'saudacao') {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Oi! 🧡 Me diz um produto (ex.: café, arroz) que eu acho onde está mais barato perto de você.',
      });
      return;
    }
    if (intent.tipo === 'ajuda') {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Eu sou a Nina 🧡, a assistente do Meu Mercado. Eu te ajudo a:\n• achar onde um produto está mais barato perto de você — é só escrever o nome (ex.: café, arroz);\n• recomendar o melhor mercado pra sua cesta ("qual mercado pra minhas compras?");\n• responder sobre as suas compras ("qual foi minha última compra?", "quanto gastei?");\n• te avisar de altas e quedas em ✨ Meus alertas.\nÉ só perguntar!',
      });
      return;
    }
    if (intent.tipo === 'listar-mercados') {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Pra ver os mercados perto de você, abre a aba 📍 Mapa aqui embaixo — mostro todos no mapa, inclusive quem já tem preço cadastrado. Aqui eu te ajudo a achar onde um produto está mais barato. 🧡',
      });
      return;
    }
    if (intent.tipo === 'listar-produtos') {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Dá pra ver todos os produtos com preço na aba 🏷️ Preços — lá você filtra e compara à vontade. Aqui eu acho onde um item específico está mais barato. 🧡',
      });
      return;
    }
    if (intent.tipo === 'historico') {
      void responderHistorico(intent.campo, intent.produto);
      return;
    }
    if (intent.tipo === 'refinar') {
      void refinarUltimo(intent.raioMetros);
      return;
    }
    if (intent.tipo === 'melhor-mercado') {
      void recomendarMercado(intent.termo);
      return;
    }
    if (!intent.termo) {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Não entendi 🤔 Me diz o nome de um produto — ex.: café, arroz, sabão.',
      });
      return;
    }
    void buscar(intent.termo, intent.raioMetros);
  }

  /** Responde perguntas sobre o histórico PESSOAL de compras do usuário. */
  async function responderHistorico(campo: CampoHistorico, produto: string | undefined) {
    setOcupada(true);
    try {
      const { compras } = await api.listarCompras();
      if (compras.length === 0) {
        empurrar({
          from: 'nina',
          kind: 'text',
          text: 'Você ainda não registrou compras 🛒 — finalize uma na aba Compra e eu passo a te contar tudo sobre os seus gastos!',
        });
        return;
      }
      empurrar({ from: 'nina', kind: 'text', text: respostaHistorico(campo, produto, compras) });
    } catch {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Não consegui ver as suas compras agora. Tenta de novo?',
      });
    } finally {
      setOcupada(false);
    }
  }

  async function buscar(termo: string, raioMetros: number | null) {
    setOcupada(true);
    try {
      const achados = (await api.ninaBuscarProdutos(termo)).slice(0, 20);
      if (achados.length === 0) {
        empurrar({
          from: 'nina',
          kind: 'text',
          text: `Não encontrei "${termo}" com preço ainda. Tente outro nome — ou registre o preço na aba Preços.`,
        });
      } else {
        // Nunca escolhe sozinho: mostra o(s) que achou pra você tocar.
        empurrar({
          from: 'nina',
          kind: 'text',
          text:
            achados.length === 1
              ? `Encontrei "${achados[0]!.nome}". É esse que você quer?`
              : `Achei ${achados.length} tipos — qual você quer?`,
        });
        empurrar({ from: 'nina', kind: 'produtos', produtos: achados, raioMetros });
      }
    } catch {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Ops, não consegui buscar agora. Tenta de novo?',
      });
    } finally {
      setOcupada(false);
    }
  }

  /** "Qual o melhor mercado para [X]?" (ou genérica, termo=null) — recomenda um mercado. */
  async function recomendarMercado(termo: string | null) {
    setOcupada(true);
    try {
      const { lat, lng } = await posicao();
      const resp = await api.melhorMercado(termo, lat, lng);
      if (resp.totalProdutos === 0 || resp.mercados.length === 0) {
        empurrar({
          from: 'nina',
          kind: 'text',
          text: `Ainda não tenho preços suficientes na base pra recomendar um mercado. Bora registrar alguns na aba Preços? 🧡`,
        });
        return;
      }
      const top = resp.mercados[0]!;
      const dist =
        top.distanciaMetros !== null ? ` (a ${formatDistancia(top.distanciaMetros)})` : '';
      const plural = resp.totalProdutos === 1 ? 'produto' : 'produtos';
      const porque =
        top.vitorias > 0
          ? `tem o menor preço em ${top.vitorias} de ${resp.totalProdutos} ${plural}${termo === null ? ' da base' : ''}`
          : 'é onde temos mais produtos com preço';
      const abertura =
        termo === null ? 'Pra fazer suas compras, com o que temos hoje' : 'Com o que temos hoje';
      empurrar({
        from: 'nina',
        kind: 'text',
        text: `${abertura}, eu iria de ${marcaMercado(top.mercadoNome).label}${dist} — ${porque}. Quanto mais preços na base, mais certeira fica. Quer ver um produto específico? 🧡`,
      });
      const resto = resp.mercados.slice(1);
      if (resto.length > 0) {
        empurrar({
          from: 'nina',
          kind: 'text',
          text:
            'Outras opções:\n' +
            resto
              .map(
                (m) =>
                  `• ${marcaMercado(m.mercadoNome).label}: ${m.produtosComPreco} ${m.produtosComPreco === 1 ? 'produto' : 'produtos'}${m.vitorias > 0 ? `, melhor em ${m.vitorias}` : ''}`,
              )
              .join('\n'),
        });
      }
    } catch {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Não consegui avaliar os mercados agora. Tenta de novo?',
      });
    } finally {
      setOcupada(false);
    }
  }

  async function refinarUltimo(raioMetros: number | null) {
    if (!ultimoProduto) {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Me diz primeiro qual produto você quer 🙂 (ex.: café, arroz) — aí eu filtro por perto.',
      });
      return;
    }
    await mostrarMercados(ultimoProduto, raioMetros ?? 3000);
  }

  // Usuário escolheu um produto da lista → registra a escolha e mostra os mercados.
  async function escolher(produto: ProdutoDTO, raioMetros: number | null) {
    empurrar({ from: 'user', kind: 'text', text: produto.nome });
    await mostrarMercados(produto, raioMetros);
  }

  async function mostrarMercados(produto: ProdutoDTO, raioMetros: number | null) {
    setUltimoProduto(produto);
    setOcupada(true);
    try {
      const { lat, lng } = await posicao();
      const resp = await api.ondeComprar(produto.id, lat, lng);
      if (resp.mercados.length === 0) {
        empurrar({
          from: 'nina',
          kind: 'text',
          text: `Ainda não tenho preço de ${produto.nome}. Seja o primeiro a registrar!`,
        });
        empurrar({ from: 'nina', kind: 'registrar', produto });
        return;
      }
      const dentro =
        raioMetros !== null
          ? resp.mercados.filter(
              (m) => m.distanciaMetros !== null && m.distanciaMetros <= raioMetros,
            )
          : resp.mercados;
      if (dentro.length > 0) {
        const barato = dentro[0]!;
        empurrar({
          from: 'nina',
          kind: 'text',
          text:
            raioMetros !== null
              ? `Dentro de ${formatDistancia(raioMetros)}, pelos preços que a comunidade informou, o mais em conta pra ${produto.nome} é o ${marcaMercado(barato.mercadoNome).label}, a ${formatBRL(barato.priceCents)}:`
              : `${produto.nome}: pelos preços da comunidade, o mais em conta é o ${marcaMercado(barato.mercadoNome).label}, a ${formatBRL(barato.priceCents)}. Veja as opções:`,
        });
        empurrar({ from: 'nina', kind: 'mercados', resp: { ...resp, mercados: dentro } });
      } else {
        // tem mercado com preço, mas nenhum dentro do raio pedido
        const comDist = resp.mercados.filter((m) => m.distanciaMetros !== null);
        const maisPerto = comDist.length
          ? Math.min(...comDist.map((m) => m.distanciaMetros as number))
          : null;
        empurrar({
          from: 'nina',
          kind: 'text',
          text:
            maisPerto !== null
              ? `Não tenho ${produto.nome} com preço a menos de ${formatDistancia(raioMetros ?? 0)} — o mais perto fica a ${formatDistancia(maisPerto)}:`
              : `Pra filtrar por distância eu preciso da sua localização. Por ora, o que tenho de ${produto.nome}:`,
        });
        empurrar({ from: 'nina', kind: 'mercados', resp });
      }
    } catch {
      empurrar({
        from: 'nina',
        kind: 'text',
        text: 'Não consegui buscar os mercados agora. Tenta de novo?',
      });
    } finally {
      setOcupada(false);
    }
  }

  async function verAlertas() {
    if (ocupada) return;
    empurrar({ from: 'user', kind: 'text', text: '✨ Meus alertas' });
    setOcupada(true);
    try {
      const { insights } = await api.insights();
      if (insights.length === 0) {
        empurrar({
          from: 'nina',
          kind: 'text',
          text: 'Ainda não tenho alertas — registre alguns preços e eu começo a analisar 😉',
        });
      } else {
        empurrar({ from: 'nina', kind: 'text', text: 'Olha o que encontrei nos seus preços 👇' });
        for (const insight of insights) empurrar({ from: 'nina', kind: 'insight', insight });
      }
    } catch {
      empurrar({ from: 'nina', kind: 'text', text: 'Não consegui carregar os alertas agora.' });
    } finally {
      setOcupada(false);
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        ref={listaRef}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex' }}
      >
        {/* marginTop:auto ancora as mensagens embaixo quando são poucas (estilo chat). */}
        <div
          style={{
            marginTop: 'auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {msgs.map((m) => (
            <Bolha key={m.id} T={T} from={m.from}>
              {m.kind === 'text' && m.text}
              {m.kind === 'produtos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m.produtos.map((p) => (
                    <button
                      key={p.id}
                      disabled={ocupada}
                      onClick={() => void escolher(p, m.raioMetros)}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        background: T.card,
                        border: `1px solid ${T.border}`,
                        borderRadius: 10,
                        padding: '9px 11px',
                        cursor: ocupada ? 'default' : 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{emojiDe(p)}</span>
                      <span style={{ color: T.text, fontSize: 13 }}>{p.nome}</span>
                    </button>
                  ))}
                </div>
              )}
              {m.kind === 'mercados' && <Mercados T={T} resp={m.resp} />}
              {m.kind === 'insight' && (
                <InsightCard
                  T={T}
                  insight={m.insight}
                  onRegistrar={
                    m.insight.produtoId ? () => abrirRegistroPreco(m.insight.produtoId!) : undefined
                  }
                />
              )}
              {m.kind === 'registrar' && (
                <button
                  onClick={() => abrirRegistroPreco(m.produto.id)}
                  style={{
                    background: T.primary,
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ➕ Registrar preço do {m.produto.nome}
                </button>
              )}
            </Bolha>
          ))}
          {ocupada && (
            <Bolha T={T} from="nina">
              <span style={{ color: T.muted }}>Nina está pensando…</span>
            </Bolha>
          )}
        </div>
      </div>

      {/* Barra de baixo (separada das mensagens e da navegação): ações + composer. */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, background: T.surface }}>
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px 0' }}>
          <button
            onClick={() => void verAlertas()}
            disabled={ocupada}
            style={{
              background: T.ninaBg,
              color: T.nina,
              border: `1px solid ${T.nina}44`,
              borderRadius: 99,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: ocupada ? 'default' : 'pointer',
            }}
          >
            ✨ Meus alertas
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            responder(texto);
          }}
          style={{ display: 'flex', gap: 8, padding: '10px 12px' }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: café, arroz, sabão…"
            style={{
              flex: 1,
              border: `1.5px solid ${T.border}`,
              borderRadius: 22,
              padding: '11px 16px',
              background: T.card,
              color: T.text,
              fontSize: 15,
            }}
          />
          <button
            type="submit"
            disabled={ocupada || texto.trim().length === 0}
            style={{
              flexShrink: 0,
              width: 44,
              background: texto.trim() && !ocupada ? T.primary : T.border,
              color: '#FFF',
              border: 'none',
              borderRadius: '50%',
              fontSize: 16,
              fontWeight: 800,
              cursor: ocupada || !texto.trim() ? 'default' : 'pointer',
            }}
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  );
}

/** Balão de mensagem (Nina à esquerda, usuário à direita). */
function Bolha({ T, from, children }: { T: Theme; from: 'nina' | 'user'; children: ReactNode }) {
  const ehNina = from === 'nina';
  return (
    <div style={{ display: 'flex', justifyContent: ehNina ? 'flex-start' : 'flex-end' }}>
      <div
        style={{
          maxWidth: '85%',
          background: ehNina ? T.card : T.primary,
          color: ehNina ? T.text : '#FFF',
          border: ehNina ? `1px solid ${T.border}` : 'none',
          borderRadius: 16,
          borderBottomLeftRadius: ehNina ? 4 : 16,
          borderBottomRightRadius: ehNina ? 16 : 4,
          padding: '10px 13px',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Um insight da Nina renderizado como cartão dentro de um balão. */
function InsightCard({
  T,
  insight,
  onRegistrar,
}: {
  T: Theme;
  insight: InsightDTO;
  onRegistrar?: (() => void) | undefined;
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20 }}>{insight.emoji}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 3px' }}>{insight.titulo}</p>
          <p style={{ color: T.sub, fontSize: 13, margin: 0, lineHeight: 1.5 }}>{insight.sub}</p>
          {insight.economia && (
            <p style={{ color: T.green, fontSize: 13, fontWeight: 700, margin: '6px 0 0' }}>
              💰 {formatBRL(insight.economia.cents)}
            </p>
          )}
        </div>
      </div>
      {onRegistrar && (
        <button
          onClick={onRegistrar}
          style={{
            marginTop: 10,
            width: '100%',
            background: T.primaryBg,
            color: T.primary,
            border: `1px solid ${T.primary}44`,
            borderRadius: 10,
            padding: '8px 0',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ➕ Registrar preço
        </button>
      )}
    </div>
  );
}

/** Cartões dos mercados ranqueados (dentro de um balão da Nina). */
function Mercados({ T, resp }: { T: Theme; resp: OndeComprarResponse }) {
  const linkBtn = {
    flex: 1,
    textAlign: 'center' as const,
    background: T.surface,
    color: T.primary,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '8px 0',
    fontSize: 12,
    fontWeight: 700,
    textDecoration: 'none',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {resp.mercados.map((m, i) => {
        const dist = formatDistancia(m.distanciaMetros);
        return (
          <div
            key={m.mercadoId}
            style={{
              background: T.surface,
              border: `1px solid ${i === 0 ? `${T.green}66` : T.border}`,
              borderRadius: 12,
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 15 }}>{MEDALHAS[i] ?? '•'}</span>
              <span style={{ color: T.text, fontSize: 13, fontWeight: 700, flex: 1 }}>
                {marcaMercado(m.mercadoNome).label}
              </span>
              <span style={{ color: i === 0 ? T.green : T.text, fontSize: 15, fontWeight: 800 }}>
                {formatBRL(m.priceCents)}
              </span>
            </div>
            <p style={{ color: T.muted, fontSize: 11, margin: 0 }}>
              {dist ? `📍 ${dist}` : '📍 distância indisponível'}
              {m.endereco ? ` · ${m.endereco}` : ''}
            </p>
            <p style={{ color: T.muted, fontSize: 10, margin: '3px 0 0', lineHeight: 1.4 }}>
              informado pela comunidade · {fmtDataCurta(m.atualizadoEm)} · confira na loja
            </p>
            {m.lat !== null && m.lng !== null && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <a
                  href={`https://waze.com/ul?ll=${m.lat},${m.lng}&navigate=yes`}
                  target="_blank"
                  rel="noreferrer"
                  style={linkBtn}
                >
                  🧭 Waze
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={linkBtn}
                >
                  🗺️ Maps
                </a>
              </div>
            )}
          </div>
        );
      })}
      {resp.totalMercados <= 1 && (
        <p style={{ color: T.muted, fontSize: 11, margin: '2px 0 0', lineHeight: 1.5 }}>
          Só tenho 1 mercado com preço desse item. Registre em outro e eu comparo pra você.
        </p>
      )}
    </div>
  );
}
