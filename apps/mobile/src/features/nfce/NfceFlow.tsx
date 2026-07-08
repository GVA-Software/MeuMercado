import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';
import type { NfceDraftDTO } from '@meumercado/contracts';
import { api, formatBRL } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { Btn } from '../../ui/kit';

type Step = 'scan' | 'loading' | 'review' | 'erro' | 'done' | 'colar';

/** Fluxo completo de importar preços pelo QR Code da nota fiscal (NFC-e). */
export function NfceFlow({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { T } = useTheme();
  const [step, setStep] = useState<Step>('scan');
  const [draft, setDraft] = useState<NfceDraftDTO | null>(null);
  const [incluidos, setIncluidos] = useState<boolean[]>([]);
  const [nomes, setNomes] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [colarTexto, setColarTexto] = useState('');
  const [ultimaUrl, setUltimaUrl] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    importados: number;
    produtosCriados: number;
  } | null>(null);

  const rodarPreview = useCallback((url: string) => {
    setUltimaUrl(url);
    setStep('loading');
    setErro(null);
    api
      .nfcePreview(url)
      .then((d) => {
        setDraft(d);
        setIncluidos(d.itens.map(() => true));
        setNomes(d.itens.map((it) => it.descricao));
        setStep('review');
      })
      .catch((e: unknown) => {
        setErro(e instanceof Error ? e.message : String(e));
        setStep('erro');
      });
  }, []);

  // Fallback: decodifica o QR de uma foto do cupom (quando o vídeo ao vivo falha).
  async function escolherFoto(file: File | null | undefined) {
    if (!file) return;
    setStep('loading');
    const txt = await decodeQrDeImagem(file);
    if (txt && /^https?:\/\//i.test(txt)) rodarPreview(txt);
    else {
      setErro('Não achei um QR nessa foto. Tente uma foto bem enquadrada do QR — ou cole o link.');
      setStep('erro');
    }
  }

  function buscarColado() {
    const t = colarTexto.trim();
    if (/^https?:\/\//i.test(t)) rodarPreview(t);
    else
      setErro('Cole o link completo (começa com https://…) que aparece ao abrir o QR na câmera.');
  }

  async function importar() {
    if (!draft) return;
    setImportando(true);
    setErro(null);
    try {
      const itens = draft.itens
        .map((it, i) => ({ it, i }))
        .filter(({ i }) => incluidos[i])
        .map(({ it, i }) => ({
          nome: (nomes[i] ?? it.descricao).trim() || it.descricao,
          priceCents: it.unitPriceCents,
          ...(it.codigo ? { codigo: it.codigo } : {}),
        }));
      const r = await api.nfceImportar({
        mercadoNome: draft.mercadoNome,
        ...(draft.mercadoCnpj
          ? { mercadoId: `nfce:cnpj:${draft.mercadoCnpj.replace(/\D/g, '')}` }
          : {}),
        ...(draft.mercadoEndereco ? { mercadoEndereco: draft.mercadoEndereco } : {}),
        ...(draft.mercadoLat !== undefined ? { mercadoLat: draft.mercadoLat } : {}),
        ...(draft.mercadoLng !== undefined ? { mercadoLng: draft.mercadoLng } : {}),
        ...(draft.dataEmissao ? { dataEmissao: draft.dataEmissao } : {}),
        itens,
      });
      setResultado(r);
      setStep('done');
      onImported();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setImportando(false);
    }
  }

  const nIncluidos = incluidos.filter(Boolean).length;

  // Descrições que aparecem mais de uma vez (tamanhos diferentes com mesmo nome
  // na NFC-e) — destacadas para o usuário diferenciar (ex.: "125g" / "75g").
  const dupDescricoes = useMemo(() => {
    const count = new Map<string, number>();
    draft?.itens.forEach((it) => count.set(it.descricao, (count.get(it.descricao) ?? 0) + 1));
    return new Set([...count].filter(([, n]) => n > 1).map(([d]) => d));
  }, [draft]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: step === 'scan' ? '#000' : 'rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: step === 'scan' ? 'stretch' : 'flex-end',
      }}
    >
      {step === 'scan' && (
        <QrScanner
          onDecode={rodarPreview}
          onClose={onClose}
          onFoto={escolherFoto}
          onColar={() => {
            setErro(null);
            setStep('colar');
          }}
        />
      )}

      {step === 'colar' && (
        <div style={sheet(T)}>
          <Handle T={T} />
          <p style={{ color: T.text, fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>
            Colar link do QR
          </p>
          <p style={{ color: T.muted, fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
            Abra a <strong>câmera do celular</strong> e aponte para o QR do cupom. Toque no link que
            aparece, copie o endereço (começa com <code>https://</code>) e cole aqui.
          </p>
          <textarea
            value={colarTexto}
            onChange={(e) => setColarTexto(e.target.value)}
            placeholder="https://www.nfce.fazenda.sp.gov.br/…"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: `1.5px solid ${T.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              background: T.card,
              color: T.text,
              fontSize: 14,
              marginBottom: 12,
              resize: 'none',
            }}
          />
          {erro && <p style={{ color: T.danger, fontSize: 13, margin: '0 0 10px' }}>{erro}</p>}
          <Btn full disabled={colarTexto.trim().length < 8} onClick={buscarColado}>
            Buscar itens
          </Btn>
          <Btn full variant="ghost" onClick={() => setStep('scan')}>
            Voltar
          </Btn>
        </div>
      )}

      {step === 'loading' && (
        <div style={sheet(T)}>
          <Handle T={T} />
          <p style={{ color: T.text, textAlign: 'center', padding: '20px 0' }}>
            Lendo a nota na SEFAZ…
          </p>
        </div>
      )}

      {step === 'erro' && (
        <div style={sheet(T)}>
          <Handle T={T} />
          <p style={{ fontSize: 40, textAlign: 'center', margin: '4px 0 8px' }}>🧾</p>
          <p style={{ color: T.text, fontWeight: 800, textAlign: 'center', margin: 0 }}>
            Não deu pra ler
          </p>
          <p style={{ color: T.muted, fontSize: 13, textAlign: 'center', margin: '6px 0 16px' }}>
            {erro}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ultimaUrl && (
              <Btn full onClick={() => rodarPreview(ultimaUrl)}>
                🔄 Tentar de novo
              </Btn>
            )}
            <Btn full variant="soft" onClick={() => setStep('scan')}>
              📷 Escanear de novo
            </Btn>
            <Btn
              full
              variant="soft"
              onClick={() => {
                setErro(null);
                setColarTexto('');
                setStep('colar');
              }}
            >
              ✏️ Colar link do QR
            </Btn>
            <Btn full variant="ghost" onClick={onClose}>
              Fechar
            </Btn>
          </div>
        </div>
      )}

      {step === 'review' && draft && (
        <div style={{ ...sheet(T), maxHeight: '88vh', overflowY: 'auto' }}>
          <Handle T={T} />
          <p style={{ color: T.text, fontSize: 17, fontWeight: 800, margin: '0 0 2px' }}>
            {draft.mercadoNome}
          </p>
          <p style={{ color: T.muted, fontSize: 13, margin: '0 0 4px' }}>
            {draft.itens.length} {draft.itens.length === 1 ? 'item' : 'itens'} lidos
            {draft.dataEmissao
              ? ` · ${new Date(draft.dataEmissao).toLocaleDateString('pt-BR')}`
              : ''}
          </p>
          <p style={{ color: T.muted, fontSize: 12, margin: '0 0 12px' }}>
            Toque no nome para editar (ex.: adicionar o tamanho). Os nomes repetidos estão em
            amarelo.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {draft.itens.map((it, i) => {
              const dup = dupDescricoes.has(it.descricao);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: incluidos[i] ? T.surface : T.card,
                    border: `1px solid ${incluidos[i] ? (dup ? T.yellow : T.primary) : T.border}`,
                    borderRadius: 12,
                    padding: '8px 10px',
                    opacity: incluidos[i] ? 1 : 0.5,
                  }}
                >
                  <button
                    onClick={() => setIncluidos((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                    aria-label="incluir ou remover item"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 16,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    {incluidos[i] ? '☑️' : '⬜'}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      value={nomes[i] ?? it.descricao}
                      onChange={(e) =>
                        setNomes((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))
                      }
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px dashed ${T.border}`,
                        color: T.text,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '2px 0',
                        outline: 'none',
                      }}
                    />
                    {dup && (
                      <span style={{ color: T.yellow, fontSize: 10, fontWeight: 700 }}>
                        ⚠ nome repetido — diferencie o tamanho
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      color: T.primary,
                      fontSize: 14,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatBRL(it.unitPriceCents)}
                  </span>
                </div>
              );
            })}
          </div>

          {erro && <p style={{ color: T.danger, fontSize: 13, margin: '0 0 10px' }}>{erro}</p>}

          <Btn full disabled={nIncluidos === 0 || importando} onClick={() => void importar()}>
            {importando
              ? 'Importando…'
              : `Importar ${nIncluidos} ${nIncluidos === 1 ? 'preço' : 'preços'}`}
          </Btn>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: T.muted,
              fontSize: 13,
              padding: '12px 0 0',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {step === 'done' && resultado && (
        <div style={sheet(T)}>
          <Handle T={T} />
          <p style={{ fontSize: 44, textAlign: 'center', margin: '4px 0 8px' }}>✅</p>
          <p style={{ color: T.text, fontWeight: 800, textAlign: 'center', margin: 0 }}>
            {resultado.importados}{' '}
            {resultado.importados === 1 ? 'preço importado' : 'preços importados'}!
          </p>
          <p style={{ color: T.muted, fontSize: 13, textAlign: 'center', margin: '6px 0 16px' }}>
            {resultado.produtosCriados > 0
              ? `${resultado.produtosCriados} produto(s) novo(s) no catálogo.`
              : 'Tudo já estava no catálogo.'}{' '}
            A Nina já está analisando.
          </p>
          <Btn full onClick={onClose}>
            Pronto
          </Btn>
        </div>
      )}
    </div>,
    document.body,
  );
}

function sheet(T: ReturnType<typeof useTheme>['T']) {
  return {
    width: '100%',
    maxWidth: 430,
    background: T.surface,
    borderRadius: '24px 24px 0 0',
    padding: '18px 20px calc(24px + env(safe-area-inset-bottom))',
  } as const;
}

function Handle({ T }: { T: ReturnType<typeof useTheme>['T'] }) {
  return (
    <div
      style={{
        width: 40,
        height: 4,
        background: T.border,
        borderRadius: 99,
        margin: '0 auto 16px',
      }}
    />
  );
}

/** Leitor de QR pela câmera (jsQR sobre frames do vídeo — funciona no iOS Safari). */
function QrScanner({
  onDecode,
  onClose,
  onFoto,
  onColar,
}: {
  onDecode: (text: string) => void;
  onClose: () => void;
  onFoto: (file: File | null | undefined) => void;
  onColar: () => void;
}) {
  const { T } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || doneRef.current) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
            const txt = code?.data?.trim();
            if (txt && /^https?:\/\//i.test(txt)) {
              doneRef.current = true;
              onDecodeRef.current(txt);
              return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setErro(
          'Não consegui abrir a câmera. Verifique a permissão nas configurações do navegador.',
        );
      }
    })();

    return () => {
      cancelled = true;
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* moldura de mira */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 240,
            height: 240,
            border: '3px solid rgba(255,255,255,0.9)',
            borderRadius: 20,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top))',
          left: 16,
          right: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{ color: '#FFF', fontWeight: 700, fontSize: 15, textShadow: '0 1px 3px #000' }}
        >
          Aponte para o QR da nota
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: '#FFF',
            border: 'none',
            borderRadius: 99,
            width: 36,
            height: 36,
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {/* Fallbacks: foto do cupom ou colar o link (quando o vídeo ao vivo falha). */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 'calc(20px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {erro && (
          <div style={{ background: T.surface, borderRadius: 14, padding: '12px 14px' }}>
            <p style={{ color: T.text, fontSize: 13, margin: 0, textAlign: 'center' }}>{erro}</p>
          </div>
        )}
        <p
          style={{
            color: '#FFF',
            fontSize: 12,
            textAlign: 'center',
            margin: 0,
            textShadow: '0 1px 3px #000',
          }}
        >
          Não leu? Use uma foto do QR ou cole o link.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={acaoScanner}>
            🖼️ Foto
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFoto(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={onColar} style={acaoScanner}>
            ✏️ Colar link
          </button>
        </div>
      </div>
    </div>
  );
}

const acaoScanner = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  background: 'rgba(255,255,255,0.92)',
  color: '#111',
  border: 'none',
  borderRadius: 12,
  padding: '12px 10px',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
} as const;

/** Decodifica o QR de uma imagem (foto do cupom) — fallback ao vídeo ao vivo. */
function decodeQrDeImagem(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data.data, canvas.width, canvas.height, {
        inversionAttempts: 'attemptBoth',
      });
      URL.revokeObjectURL(img.src);
      resolve(code?.data?.trim() ?? null);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}
