import { createContext, useContext } from 'react';

/** Mercado a focar no mapa (vindo de outra aba, ex.: "Ver no mapa" nos Preços). */
export interface MapFocus {
  lat: number;
  lng: number;
  nome: string;
  endereco?: string;
}

interface NavCtx {
  irParaMapa: (foco: MapFocus) => void;
  /** Abre a aba Preços já no registro de preço de um produto (deep-link da Nina). */
  abrirRegistroPreco: (produtoId: string) => void;
}

const Ctx = createContext<NavCtx>({
  irParaMapa: () => {},
  abrirRegistroPreco: () => {},
});

export const NavProvider = Ctx.Provider;

export function useNav(): NavCtx {
  return useContext(Ctx);
}
