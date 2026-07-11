import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OndeComprarResponse, ProdutoDTO } from '@meumercado/contracts';
import { api, formatBRL } from '../../api/client';
import { useNav } from '../../app/nav';
import type { Theme } from '../../theme/theme';
import { emojiDe } from '../../ui/emoji';

const MEDALHAS = ['🥇', '🥈', '🥉'];

function formatDistancia(m: number | null): string | null {
  if (m === null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Uma mensagem do bate-papo (Nina ou usuário). */
type Msg =
  | { id: number; from: 'nina' | 'user'; kind: 'text'; text: string }
  | { id: number; from: 'nina'; kind: 'produtos'; produtos: ProdutoDTO[] }
  | { id: number; from: 'nina'; kind: 'mercados'; resp: OndeComprarResponse; produto: ProdutoDTO }
  | { id: number; from: 'nina'; kind: 'registrar'; produto: ProdutoDTO };

// Omit distributivo: preserva cada variante da união (Omit normal colapsa nos
// campos comuns), pra `empurrar` aceitar uma mensagem sem o `id`.
type SemId<T> = T extends unknown ? Omit<T, 'id'> : never;

const SAUDACAO: Msg = {
  id: 0,
  from: 'nina',
  kind: 'text',
  text: 'Oi! Sou a Nina 💜 Me diz o que você quer comprar e eu acho os melhores mercados perto de você.',
};

/**
 * Nina interativa em formato de bate-papo. Você escreve um termo (ex.: "café") →
 * ela mostra TODOS os tipos que encontrou → você escolhe → ela ranqueia os
 * mercados por preço + distância. Onde falta dado, convida a registrar.
 */
export function NinaOndeComprar({ T }: { T: Theme }) {
  const { abrirRegistroPreco } = useNav();
  const [msgs, setMsgs] = useState<Msg[]>([SAUDACAO]);
  const [texto, setTexto] = useState('');
  const [ocupada, setOcupada] = useState(false);
  const idRef = useRef(1);
  const listaRef = useRef<HTMLDivElement>(null);

  const proximoId = () => idRef.current++;
  const empurrar = (m: SemId<Msg>) =>
    setMsgs((atual) => [...atual, { ...m, id: proximoId() } as Msg]);

  // Mantém o chat rolado no fim a cada nova mensagem.
  useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, ocupada]);

  async function enviarTermo(termoBruto: string) {
    const termo = termoBruto.trim();
    if (!termo || ocupada) return;
    empurrar({ from: 'user', kind: 'text', text: termo });
    setTexto('');
    setOcupada(true);
    try {
      const achados = (await api.buscarProdutos(termo)).slice(0, 20);
      if (achados.length === 0) {
        empurrar({
          from: 'nina',
          kind: 'text',
          text: `Não encontrei "${termo}" ainda. Tente outro nome — ou registre o preço e ele passa a existir na base.`,
        });
      } else if (achados.length === 1) {
        await consultarMercados(achados[0]!);
      } else {
        empurrar({
          from: 'nina',
          kind: 'text',
          text: `Achei ${achados.length} opções de "${termo}". Qual você quer?`,
        });
        empurrar({ from: 'nina', kind: 'produtos', produtos: achados });
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

  async function consultarMercados(produto: ProdutoDTO) {
    empurrar({ from: 'user', kind: 'text', text: produto.nome });
    setOcupada(true);
    const posicao = (): Promise<{ lat?: number; lng?: number }> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve({}),
          { enableHighAccuracy: true, timeout: 8000 },
        );
      });
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
      } else {
        const barato = resp.mercados[0]!;
        empurrar({
          from: 'nina',
          kind: 'text',
          text: `${produto.nome}: mais barato no ${barato.mercadoNome}, ${formatBRL(barato.priceCents)}. Veja as opções:`,
        });
        empurrar({ from: 'nina', kind: 'mercados', resp, produto });
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

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 18,
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
        <p style={{ color: T.text, fontSize: 16, fontWeight: 800, margin: 0 }}>
          🛒 Onde eu compro?
        </p>
      </div>

      <div
        ref={listaRef}
        style={{
          maxHeight: 380,
          overflowY: 'auto',
          padding: 14,
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
                    onClick={() => void consultarMercados(p)}
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviarTermo(texto);
        }}
        style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${T.border}` }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: café, arroz, sabão…"
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
        <button
          type="submit"
          disabled={ocupada || texto.trim().length === 0}
          style={{
            flexShrink: 0,
            background: texto.trim() && !ocupada ? T.primary : T.border,
            color: '#FFF',
            border: 'none',
            borderRadius: 12,
            padding: '0 16px',
            fontSize: 16,
            fontWeight: 800,
            cursor: ocupada || !texto.trim() ? 'default' : 'pointer',
          }}
        >
          ➤
        </button>
      </form>
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
          borderRadius: 14,
          borderBottomLeftRadius: ehNina ? 4 : 14,
          borderBottomRightRadius: ehNina ? 14 : 4,
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
                {m.mercadoNome}
              </span>
              <span style={{ color: i === 0 ? T.green : T.text, fontSize: 15, fontWeight: 800 }}>
                {formatBRL(m.priceCents)}
              </span>
            </div>
            <p style={{ color: T.muted, fontSize: 11, margin: 0 }}>
              {dist ? `📍 ${dist}` : '📍 distância indisponível'}
              {m.endereco ? ` · ${m.endereco}` : ''}
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
