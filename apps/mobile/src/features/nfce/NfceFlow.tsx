import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';
import type { NfceDraftDTO } from '@meumercado/contracts';
import { api, formatBRL } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { Btn } from '../../ui/kit';

type Step = 'scan' | 'loading' | 'review' | 'erro' | 'done';

/** Fluxo completo de importar preços pelo QR Code da nota fiscal (NFC-e). */
export function NfceFlow({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { T } = useTheme();
  const [step, setStep] = useState<Step>('scan');
  const [draft, setDraft] = useState<NfceDraftDTO | null>(null);
  const [incluidos, setIncluidos] = useState<boolean[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
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
        setStep('review');
      })
      .catch((e: unknown) => {
        setErro(e instanceof Error ? e.message : String(e));
        setStep('erro');
      });
  }, []);

  async function importar() {
    if (!draft) return;
    setImportando(true);
    setErro(null);
    try {
      const itens = draft.itens
        .filter((_, i) => incluidos[i])
        .map((it) => ({ nome: it.descricao, priceCents: it.unitPriceCents }));
      const r = await api.nfceImportar({
        mercadoNome: draft.mercadoNome,
        ...(draft.mercadoCnpj
          ? { mercadoId: `nfce:cnpj:${draft.mercadoCnpj.replace(/\D/g, '')}` }
          : {}),
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
      {step === 'scan' && <QrScanner onDecode={rodarPreview} onClose={onClose} />}

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
            <Btn full variant={ultimaUrl ? 'soft' : 'primary'} onClick={() => setStep('scan')}>
              📷 Escanear de novo
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
          <p style={{ color: T.muted, fontSize: 13, margin: '0 0 14px' }}>
            {draft.itens.length} {draft.itens.length === 1 ? 'item' : 'itens'} lidos
            {draft.dataEmissao
              ? ` · ${new Date(draft.dataEmissao).toLocaleDateString('pt-BR')}`
              : ''}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {draft.itens.map((it, i) => (
              <button
                key={i}
                onClick={() => setIncluidos((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: incluidos[i] ? T.surface : T.card,
                  border: `1px solid ${incluidos[i] ? T.primary : T.border}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  opacity: incluidos[i] ? 1 : 0.55,
                }}
              >
                <span style={{ fontSize: 16 }}>{incluidos[i] ? '☑️' : '⬜'}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: T.text,
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.descricao}
                </span>
                <span style={{ color: T.primary, fontSize: 14, fontWeight: 800 }}>
                  {formatBRL(it.unitPriceCents)}
                </span>
              </button>
            ))}
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
}: {
  onDecode: (text: string) => void;
  onClose: () => void;
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
            const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
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

      {erro && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 'calc(28px + env(safe-area-inset-bottom))',
            background: T.surface,
            borderRadius: 14,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <p style={{ color: T.text, fontSize: 14, margin: '0 0 12px' }}>{erro}</p>
          <Btn full variant="ghost" onClick={onClose}>
            Fechar
          </Btn>
        </div>
      )}
    </div>
  );
}
