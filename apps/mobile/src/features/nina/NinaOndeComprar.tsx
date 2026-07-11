import { useEffect, useState } from 'react';
import type { OndeComprarResponse, ProdutoDTO } from '@meumercado/contracts';
import { api, formatBRL } from '../../api/client';
import { useNav } from '../../app/nav';
import type { Theme } from '../../theme/theme';
import { emojiDe } from '../../ui/emoji';
import { Btn, CartLoader, EmptyState } from '../../ui/kit';

const MEDALHAS = ['🥇', '🥈', '🥉'];

function formatDistancia(m: number | null): string | null {
  if (m === null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Nina interativa: "onde eu compro este produto?". Escolhe o produto → pega a
 * localização → ranqueia os mercados com preço por preço + distância. Onde falta
 * dado, convida a registrar (fecha no loop de cobertura).
 */
export function NinaOndeComprar({ T }: { T: Theme }) {
  const { abrirRegistroPreco } = useNav();
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<ProdutoDTO[]>([]);
  const [produto, setProduto] = useState<ProdutoDTO | null>(null);
  const [resp, setResp] = useState<OndeComprarResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (produto || t.length < 2) {
      setResultados([]);
      return;
    }
    let vivo = true;
    void api
      .buscarProdutos(t)
      .then((r) => {
        if (vivo) setResultados(r.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [q, produto]);

  function consultar(p: ProdutoDTO) {
    setProduto(p);
    setResultados([]);
    setQ('');
    setResp(null);
    setErro(null);
    setCarregando(true);
    const buscar = (lat?: number, lng?: number) => {
      api
        .ondeComprar(p.id, lat, lng)
        .then(setResp)
        .catch((e) => setErro(e instanceof Error ? e.message : String(e)))
        .finally(() => setCarregando(false));
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => buscar(pos.coords.latitude, pos.coords.longitude),
        () => buscar(), // sem localização → ranqueia só por preço
        { enableHighAccuracy: true, timeout: 8000 },
      );
    } else {
      buscar();
    }
  }

  const input = {
    border: `1.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    background: T.card,
    color: T.text,
    fontSize: 15,
    width: '100%',
    boxSizing: 'border-box' as const,
  };
  const linkBtn = {
    flex: 1,
    textAlign: 'center' as const,
    background: T.card,
    color: T.primary,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '9px 0',
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  };

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <p style={{ color: T.text, fontSize: 16, fontWeight: 800, margin: '0 0 2px' }}>
        🛒 Onde eu compro?
      </p>
      <p style={{ color: T.muted, fontSize: 12, margin: '0 0 12px', lineHeight: 1.5 }}>
        Escolha um produto e eu acho os melhores mercados perto de você.
      </p>

      {!produto ? (
        <>
          <input
            placeholder="Buscar produto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={input}
          />
          {resultados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {resultados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => consultar(p)}
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
            </div>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: T.primaryBg,
              border: `1px solid ${T.primary}55`,
              borderRadius: 12,
              padding: '11px 14px',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>{emojiDe(produto)}</span>
            <span style={{ color: T.text, fontSize: 14, fontWeight: 700, flex: 1 }}>
              {produto.nome}
            </span>
            <button
              onClick={() => {
                setProduto(null);
                setResp(null);
                setErro(null);
              }}
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
          </div>

          {carregando && <CartLoader label="Procurando os melhores mercados…" />}
          {erro && <EmptyState emoji="⚠️" titulo="Não consegui buscar" sub={erro} />}

          {resp && resp.mercados.length === 0 && (
            <div style={{ textAlign: 'center' }}>
              <EmptyState
                emoji="🗺️"
                titulo="Ainda não tenho preço desse produto"
                sub="Seja o primeiro a registrar — aí eu passo a dizer onde ele está mais barato."
              />
              <Btn full variant="soft" onClick={() => abrirRegistroPreco(produto.id)}>
                ➕ Registrar preço do {produto.nome}
              </Btn>
            </div>
          )}

          {resp && resp.mercados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resp.mercados.map((m, i) => {
                const dist = formatDistancia(m.distanciaMetros);
                return (
                  <div
                    key={m.mercadoId}
                    style={{
                      background: T.card,
                      border: `1px solid ${i === 0 ? `${T.green}66` : T.border}`,
                      borderRadius: 14,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{MEDALHAS[i] ?? '•'}</span>
                      <span style={{ color: T.text, fontSize: 14, fontWeight: 700, flex: 1 }}>
                        {m.mercadoNome}
                      </span>
                      <span
                        style={{ color: i === 0 ? T.green : T.text, fontSize: 16, fontWeight: 800 }}
                      >
                        {formatBRL(m.priceCents)}
                      </span>
                    </div>
                    <p style={{ color: T.muted, fontSize: 12, margin: 0 }}>
                      {dist ? `📍 ${dist}` : '📍 distância indisponível'}
                      {m.endereco ? ` · ${m.endereco}` : ''}
                    </p>
                    {m.lat !== null && m.lng !== null && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
                <button
                  onClick={() => abrirRegistroPreco(produto.id)}
                  style={{
                    background: 'none',
                    border: `1px dashed ${T.border}`,
                    borderRadius: 12,
                    padding: '10px 12px',
                    color: T.sub,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Só tenho 1 mercado pra esse item — registre em outro e eu comparo ›
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
