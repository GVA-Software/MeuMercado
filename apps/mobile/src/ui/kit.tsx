import type { CSSProperties, ReactNode } from 'react';
import { useTheme, type Theme } from '../theme/theme';

export function AppLogo({ size = 20, inverted = false }: { size?: number; inverted?: boolean }) {
  const { T } = useTheme();
  const textColor = inverted ? T.headerText : T.primary;
  const sz = size + 8;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <img
        src="/cart.png"
        alt=""
        width={sz}
        height={sz}
        style={{
          borderRadius: sz * 0.28,
          objectFit: 'cover',
          display: 'block',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
      <span style={{ color: textColor, fontWeight: 800, fontSize: size, letterSpacing: -0.3 }}>
        Meu Mercado
      </span>
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
