import type { CSSProperties, ReactNode } from 'react';
import { useTheme, type Theme } from '../theme/theme';

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
        <p style={{ color: T.muted, fontSize: 14, fontWeight: 700, margin: 0, textAlign: 'center' }}>
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
        {dark ? 'Dia' : 'Dark'}
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
