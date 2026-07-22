import { useCallback, useState } from 'react';

export interface Posicao {
  lat: number;
  lng: number;
}

/**
 * Pega a posição do usuário SOB DEMANDA (só ao chamar `pedir()`, num gesto — nunca
 * no mount, pra não disparar o prompt de GPS sem o usuário pedir). Guarda a última
 * posição e os estados de carregando/erro. Options robustas (as mesmas do fluxo do
 * carrinho): alta precisão, timeout de 12s, cache de 60s.
 */
export function useGeolocation() {
  const [pos, setPos] = useState<Posicao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pedir = useCallback((): Promise<Posicao | null> => {
    if (!navigator.geolocation) {
      setErro('Geolocalização não é suportada neste aparelho.');
      return Promise.resolve(null);
    }
    setCarregando(true);
    setErro(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const nova = { lat: p.coords.latitude, lng: p.coords.longitude };
          setPos(nova);
          setCarregando(false);
          resolve(nova);
        },
        () => {
          setErro('Não consegui a sua localização. Ative a permissão e tente de novo.');
          setCarregando(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    });
  }, []);

  return { pos, carregando, erro, pedir };
}
