import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Theme {
  bg: string;
  surface: string;
  card: string;
  border: string;
  borderMid: string;
  primary: string;
  primaryBg: string;
  headerBg: string;
  headerText: string;
  green: string;
  greenBg: string;
  yellow: string;
  yellowBg: string;
  danger: string;
  dangerBg: string;
  nina: string;
  ninaBg: string;
  ninaGrad: string;
  text: string;
  sub: string;
  muted: string;
  shadow: string;
  navBg: string;
}

/** Paleta clara — extraída do protótipo. */
export const LIGHT: Theme = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  card: '#F5F4F0',
  border: '#E8E6DF',
  borderMid: '#D4D0C8',
  primary: '#FF6B2B',
  primaryBg: '#FFF0EA',
  headerBg: '#FF6B2B',
  headerText: '#FFFFFF',
  green: '#1DB954',
  greenBg: '#E8F9EE',
  yellow: '#F5A623',
  yellowBg: '#FEF6E4',
  danger: '#E53935',
  dangerBg: '#FDECEA',
  nina: '#0EA5E9',
  ninaBg: '#E0F2FE',
  ninaGrad: 'linear-gradient(135deg,#0EA5E9,#6366F1)',
  text: '#1A1A1A',
  sub: '#555555',
  muted: '#999999',
  shadow: 'rgba(0,0,0,0.07)',
  navBg: '#FFFFFF',
};

/** Paleta escura. */
export const DARK: Theme = {
  bg: '#0D0F14',
  surface: '#161A23',
  card: '#1E2330',
  border: '#252B3A',
  borderMid: '#2E3648',
  primary: '#FF6B2B',
  primaryBg: '#2A1A10',
  headerBg: '#1A1208',
  headerText: '#FF9A6C',
  green: '#1DB954',
  greenBg: '#0D2B1A',
  yellow: '#F5A623',
  yellowBg: '#2A2008',
  danger: '#F05252',
  dangerBg: '#2A0D0D',
  nina: '#38BDF8',
  ninaBg: '#0C2233',
  ninaGrad: 'linear-gradient(135deg,#0EA5E9,#6366F1)',
  text: '#EDF2FF',
  sub: '#A0ABBB',
  muted: '#5A6478',
  shadow: 'rgba(0,0,0,0.35)',
  navBg: '#161A23',
};

interface ThemeCtx {
  T: Theme;
  dark: boolean;
  setDark: (v: boolean) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('mm-theme') === 'dark');

  useEffect(() => {
    localStorage.setItem('mm-theme', dark ? 'dark' : 'light');
    document.body.style.background = (dark ? DARK : LIGHT).bg;
  }, [dark]);

  const value = useMemo<ThemeCtx>(() => ({ T: dark ? DARK : LIGHT, dark, setDark }), [dark]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>');
  return ctx;
}
