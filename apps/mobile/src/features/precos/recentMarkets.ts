/**
 * Mercados usados recentemente (persistidos no aparelho). Servem de atalho de 1
 * toque ao registrar um preço — é o que destrava a COBERTURA: quem compra sempre
 * no Atacadão e no Rossi registra o mesmo item nos dois em segundos, e aí a Nina
 * passa a comparar de verdade.
 */
export interface RecentMarket {
  id: string | null;
  nome: string;
  endereco?: string;
  lat?: number;
  lng?: number;
}

const KEY = 'mm-recent-markets';
const MAX = 6;

export function getRecentMarkets(): RecentMarket[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentMarket[]) : [];
  } catch {
    return [];
  }
}

/** Registra o mercado no topo da lista (dedup por nome, mais recentes primeiro). */
export function pushRecentMarket(m: RecentMarket): void {
  try {
    const nome = m.nome.trim();
    if (!nome) return;
    const atual = getRecentMarkets().filter((x) => x.nome.toLowerCase() !== nome.toLowerCase());
    localStorage.setItem(KEY, JSON.stringify([{ ...m, nome }, ...atual].slice(0, MAX)));
  } catch {
    /* storage indisponível — atalho é só conveniência, ignora */
  }
}
