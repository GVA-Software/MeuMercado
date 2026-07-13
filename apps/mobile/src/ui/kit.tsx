import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, type Theme } from '../theme/theme';

/**
 * Botão flutuante "voltar ao topo" — aparece só depois de rolar mais de uma tela
 * e some ao tocar (ancora o scroll no topo). Fica dentro do container do app
 * (.app-shell), então alinha certo em qualquer largura.
 */
export function ScrollTopFab({ tab }: { tab: string }) {
  const { T } = useTheme();
  const [show, setShow] = useState(false);

  // Depende de `tab`: ao trocar de aba o `.app-scroll` remonta (key={tab}), então
  // reatacha o listener no container novo e zera o estado. (Sem key própria aqui —
  // key duplicada com o `.app-scroll` empilhava as telas no WebKit.)
  useEffect(() => {
    setShow(false);
    const el = document.querySelector('.app-scroll') as HTMLElement | null;
    if (!el) return;
    const onScroll = () => setShow(el.scrollTop > el.clientHeight);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [tab]);

  if (!show) return null;
  return (
    <button
      aria-label="Voltar ao topo"
      onClick={() => {
        const el = document.querySelector('.app-scroll') as HTMLElement | null;
        el?.scrollTo({ top: 0, behavior: 'smooth' });
        setShow(false);
      }}
      style={{
        position: 'absolute',
        right: 16,
        bottom: 96,
        zIndex: 95,
        width: 46,
        height: 46,
        borderRadius: '50%',
        background: T.primary,
        color: '#FFF',
        border: 'none',
        boxShadow: '0 6px 20px rgba(255,107,43,0.45)',
        fontSize: 22,
        fontWeight: 800,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      ↑
    </button>
  );
}

/** Modal central bloqueante — cobre a tela; só sai interagindo com os botões dentro. */
export function Modal({ children }: { children: ReactNode }) {
  const { T } = useTheme();
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 22,
          padding: '26px 22px',
          width: '100%',
          maxWidth: 360,
          textAlign: 'center',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmação (2 botões) — não fecha sem escolher prosseguir ou cancelar. */
export function ConfirmDialog({
  emoji = '⚠️',
  titulo,
  mensagem,
  confirmarLabel = 'Confirmar',
  cancelarLabel = 'Cancelar',
  perigo = false,
  ocupado = false,
  onConfirmar,
  onCancelar,
}: {
  emoji?: string;
  titulo: string;
  mensagem: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  perigo?: boolean;
  ocupado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const { T } = useTheme();
  return (
    <Modal>
      <div style={{ fontSize: 40, marginBottom: 8 }}>{emoji}</div>
      <h2 style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>{titulo}</h2>
      <p style={{ color: T.muted, fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
        {mensagem}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancelar}
          disabled={ocupado}
          style={{
            flex: 1,
            background: T.card,
            color: T.text,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: '12px 0',
            fontSize: 14,
            fontWeight: 700,
            cursor: ocupado ? 'default' : 'pointer',
          }}
        >
          {cancelarLabel}
        </button>
        <button
          onClick={onConfirmar}
          disabled={ocupado}
          style={{
            flex: 1,
            background: perigo ? T.danger : T.primary,
            color: '#FFF',
            border: 'none',
            borderRadius: 12,
            padding: '12px 0',
            fontSize: 14,
            fontWeight: 800,
            cursor: ocupado ? 'default' : 'pointer',
          }}
        >
          {ocupado ? 'Aguarde…' : confirmarLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Aviso/sucesso (1 botão). */
export function AvisoDialog({
  emoji = '✅',
  titulo,
  mensagem,
  okLabel = 'Ok',
  onOk,
}: {
  emoji?: string;
  titulo: string;
  mensagem?: string;
  okLabel?: string;
  onOk: () => void;
}) {
  const { T } = useTheme();
  return (
    <Modal>
      <div style={{ fontSize: 44, marginBottom: 8 }}>{emoji}</div>
      <h2 style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>{titulo}</h2>
      {mensagem && (
        <p style={{ color: T.muted, fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
          {mensagem}
        </p>
      )}
      <Btn full onClick={onOk}>
        {okLabel}
      </Btn>
    </Modal>
  );
}

export function AppLogo({ size = 20, inverted = false }: { size?: number; inverted?: boolean }) {
  const { T } = useTheme();
  const textColor = inverted ? T.headerText : T.primary;
  const sz = size + 12;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <img
        src="/Loading.png"
        alt=""
        width={sz}
        height={sz}
        style={{
          objectFit: 'contain',
          display: 'block',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))',
        }}
      />
      <span style={{ color: textColor, fontWeight: 800, fontSize: size, letterSpacing: -0.3 }}>
        Meu Mercado
      </span>
    </div>
  );
}

/**
 * Loading padrão do app: nosso carrinho pulsando até o conteúdo carregar.
 * Usado em toda tela/estado de carregamento (boot, mapa, nota, análise…).
 */
export function CartLoader({
  label,
  size = 88,
  center = false,
}: {
  label?: string;
  size?: number;
  center?: boolean;
}) {
  const { T } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '28px 20px',
        ...(center ? { minHeight: '60vh' } : {}),
      }}
    >
      <img
        src="/Loading.png"
        alt=""
        width={size}
        height={size}
        style={{
          objectFit: 'contain',
          animation: 'mm-logo-bob 1s ease-in-out infinite, mm-logo-glow 1.6s ease-in-out infinite',
        }}
      />
      {label && (
        <p
          style={{ color: T.muted, fontSize: 14, fontWeight: 700, margin: 0, textAlign: 'center' }}
        >
          {label}
        </p>
      )}
    </div>
  );
}

export function Card({
  children,
  style,
  color,
}: {
  children: ReactNode;
  style?: CSSProperties;
  color?: string;
}) {
  const { T } = useTheme();
  return (
    <div
      style={{
        background: T.surface,
        borderRadius: 16,
        border: `1px solid ${color ?? T.border}`,
        boxShadow: `0 1px 4px ${T.shadow}`,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'soft' | 'nina';

export function Btn({
  children,
  onClick,
  variant = 'primary',
  full = false,
  small = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  full?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  const styles: Record<BtnVariant, { bg: string; fg: string; br: string; sh: string }> = {
    primary: { bg: T.primary, fg: '#FFF', br: 'none', sh: '0 2px 8px rgba(255,107,43,0.3)' },
    ghost: { bg: 'transparent', fg: T.sub, br: `1.5px solid ${T.border}`, sh: 'none' },
    soft: { bg: T.primaryBg, fg: T.primary, br: 'none', sh: 'none' },
    nina: { bg: T.ninaGrad, fg: '#FFF', br: 'none', sh: '0 2px 12px rgba(14,165,233,0.3)' },
  };
  const s = styles[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: s.bg,
        color: s.fg,
        border: s.br,
        boxShadow: s.sh,
        borderRadius: 14,
        padding: small ? '10px 16px' : '14px 20px',
        fontSize: small ? 13 : 15,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: full ? '100%' : 'auto',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Campo de dinheiro: abre o teclado numérico (inputMode) e aplica a máscara de
 * moeda automaticamente — cada dígito entra pelos centavos ("1500" → 15,00;
 * "150000" → 1.500,00). Emite o valor em centavos.
 */
export function CurrencyInput({
  cents,
  onCents,
  placeholder = '0,00',
  autoFocus = false,
  onBlur,
  onEnter,
  style,
}: {
  cents: number;
  onCents: (cents: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onEnter?: () => void;
  style?: CSSProperties;
}) {
  const { T } = useTheme();
  const display =
    cents > 0 ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  return (
    <input
      autoFocus={autoFocus}
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={(e) => onCents(parseInt(e.target.value.replace(/\D/g, '').slice(0, 9) || '0', 10))}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter') onEnter?.();
      }}
      style={{
        border: `1.5px solid ${T.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        background: T.card,
        color: T.text,
        fontSize: 15,
        ...style,
      }}
    />
  );
}

export function SLabel({ children }: { children: ReactNode }) {
  const { T } = useTheme();
  return (
    <p
      style={{
        color: T.muted,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        margin: '0 0 10px',
      }}
    >
      {children}
    </p>
  );
}

export function Pill({ color, bg, label }: { color: string; bg?: string; label: string }) {
  return (
    <span
      style={{
        background: bg ?? `${color}20`,
        color,
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 99,
      }}
    >
      {label}
    </span>
  );
}

export function ThemeToggle() {
  const { dark, setDark } = useTheme();
  return (
    <button
      onClick={() => setDark(!dark)}
      style={{
        background: dark ? '#252B3A' : '#F0EDE6',
        border: 'none',
        borderRadius: 99,
        padding: '6px 10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 15 }}>{dark ? '☀️' : '🌙'}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: dark ? '#A0ABBB' : '#555' }}>
        {dark ? 'Dia' : 'Noite'}
      </span>
    </button>
  );
}

export function EmptyState({
  emoji,
  titulo,
  sub,
}: {
  emoji: string;
  titulo: string;
  sub?: string;
}) {
  const { T }: { T: Theme } = useTheme();
  return (
    <div style={{ textAlign: 'center', padding: '32px 20px' }}>
      <p style={{ fontSize: 44, margin: '0 0 10px' }}>{emoji}</p>
      <p style={{ color: T.text, fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>{titulo}</p>
      {sub && <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>{sub}</p>}
    </div>
  );
}
