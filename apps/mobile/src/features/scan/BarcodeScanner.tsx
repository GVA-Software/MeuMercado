import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme/theme';
import { CartLoader } from '../../ui/kit';

/** Valida o dígito verificador do GTIN (EAN-8/UPC-A/EAN-13/GTIN-14). */
export function eanValido(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Da direita p/ esquerda, pesos 3,1,3,1…
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Leitor de código de barras (EAN/UPC). Reaproveita o esqueleto de câmera do
 * QrScanner da NFC-e (getUserMedia rear + loop RAF + canvas), mas decodifica com o
 * ZXing (`@zxing/library`, carregado sob demanda) restrito a formatos de produto.
 * Sempre tem o fallback "digitar o código" (câmera falhou / barras ilegível).
 */
export function BarcodeScanner({
  onDetectar,
  onClose,
}: {
  onDetectar: (ean: string) => void;
  onClose: () => void;
}) {
  const { T } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const onDetectarRef = useRef(onDetectar);
  onDetectarRef.current = onDetectar;

  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [temTorch, setTemTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  // Após ler o código, mostra o loader enquanto o pai busca o produto (o pai fecha
  // o scanner quando termina). Toda espera tem feedback na tela.
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let zxing: typeof import('@zxing/library') | null = null;
    let reader: import('@zxing/library').MultiFormatReader | null = null;
    let hints: Map<number, unknown> | null = null;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || doneRef.current || !reader || !zxing || !hints) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            try {
              const src = new zxing.HTMLCanvasElementLuminanceSource(canvas);
              const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(src));
              const txt = reader.decode(bitmap, hints).getText().trim();
              if (eanValido(txt)) {
                doneRef.current = true;
                setProcessando(true);
                onDetectarRef.current(txt);
                return; // não re-agenda
              }
            } catch {
              /* NotFoundException: sem código de barras neste frame */
            } finally {
              reader.reset();
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = async () => {
      try {
        zxing = await import('@zxing/library');
        reader = new zxing.MultiFormatReader();
        hints = new Map<number, unknown>([
          [
            zxing.DecodeHintType.POSSIBLE_FORMATS,
            [zxing.BarcodeFormat.EAN_13, zxing.BarcodeFormat.EAN_8, zxing.BarcodeFormat.UPC_A],
          ],
          [zxing.DecodeHintType.TRY_HARDER, true],
        ]);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (caps.torch) setTemTorch(true);
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled)
          setErro('Não consegui abrir a câmera. Confira a permissão ou digite o código abaixo.');
      }
    };

    void start();
    return () => {
      cancelled = true;
      doneRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }],
      } as unknown as MediaTrackConstraints);
      setTorchOn((v) => !v);
    } catch {
      /* alguns aparelhos não permitem controlar a lanterna */
    }
  }

  function enviarManual() {
    const code = manual.replace(/\D/g, '');
    if (eanValido(code)) {
      doneRef.current = true;
      setProcessando(true);
      onDetectar(code);
    } else {
      setErro('Código inválido — confira os dígitos do código de barras.');
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Leu o código: cobre tudo com o nosso loader enquanto o produto carrega. */}
      {processando && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            background: T.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CartLoader label="Encontrei! Buscando o produto…" size={72} />
        </div>
      )}
      {/* Câmera */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Moldura de mira (retângulo largo, típico de código de barras) */}
        {!erro && (
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
                width: '78%',
                maxWidth: 320,
                height: 150,
                border: '3px solid rgba(255,255,255,0.9)',
                borderRadius: 14,
                boxShadow: '0 0 0 2000px rgba(0,0,0,0.45)',
              }}
            />
          </div>
        )}

        {/* Topo: título + fechar + lanterna */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '16px 16px calc(16px + env(safe-area-inset-top))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span style={{ color: '#FFF', fontSize: 15, fontWeight: 700 }}>
            Aponte para o código de barras
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {temTorch && (
              <button
                onClick={() => void toggleTorch()}
                aria-label="Lanterna"
                style={{
                  background: torchOn ? '#FFF' : 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: 999,
                  width: 40,
                  height: 40,
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                🔦
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Fechar"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 999,
                width: 40,
                height: 40,
                color: '#FFF',
                fontSize: 18,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Rodapé: erro (se houver) + fallback de digitar o código */}
      <div
        style={{
          background: T.surface,
          padding: '16px 20px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {erro && <p style={{ color: T.danger, fontSize: 13, margin: 0 }}>{erro}</p>}
        <p style={{ color: T.muted, fontSize: 12, margin: 0 }}>
          Não leu? Digite os números embaixo do código de barras:
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Ex.: 7891000315507"
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
            onClick={enviarManual}
            disabled={manual.replace(/\D/g, '').length < 8}
            style={{
              flexShrink: 0,
              background: T.primary,
              color: '#FFF',
              border: 'none',
              borderRadius: 12,
              padding: '0 18px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: manual.replace(/\D/g, '').length < 8 ? 0.5 : 1,
            }}
          >
            Usar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
