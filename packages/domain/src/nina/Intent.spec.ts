import { describe, expect, it } from 'vitest';
import { interpretar } from './Intent.js';

describe('interpretar — intenção da conversa da Nina', () => {
  it('reconhece agradecimento', () => {
    for (const t of ['Obrigado', 'obrigada!', 'valeu', 'vlw', 'muito obrigado 🙏']) {
      expect(interpretar(t).tipo).toBe('agradecimento');
    }
  });

  it('reconhece saudação', () => {
    for (const t of ['Oi', 'olá', 'bom dia', 'e aí']) {
      expect(interpretar(t).tipo).toBe('saudacao');
    }
  });

  it('reconhece pedido de ajuda', () => {
    expect(interpretar('como funciona?').tipo).toBe('ajuda');
  });

  it('extrai o produto de uma frase natural', () => {
    expect(interpretar('arroz')).toEqual({ tipo: 'buscar', termo: 'arroz', raioMetros: null });
    expect(interpretar('quero comprar café mais barato')).toEqual({
      tipo: 'buscar',
      termo: 'cafe',
      raioMetros: null,
    });
    expect(interpretar('onde tem sabão em pó perto de mim')).toEqual({
      tipo: 'buscar',
      termo: 'sabao em po',
      raioMetros: null,
    });
  });

  it('preserva conectores internos do nome do produto', () => {
    expect(interpretar('pão de forma').termo).toBe('pao de forma');
  });

  it('entende refinamento por raio quando não há produto na frase', () => {
    const r = interpretar('Quero em um raio de 3km perto de mim, qual seria o melhor mercado?');
    expect(r).toEqual({ tipo: 'refinar', raioMetros: 3000 });
  });

  it('entende "perto de mim" como refinamento sem número', () => {
    expect(interpretar('e o mais perto de mim?')).toEqual({ tipo: 'refinar', raioMetros: null });
  });

  it('carrega o raio junto quando há produto e distância', () => {
    expect(interpretar('arroz a menos de 2km')).toEqual({
      tipo: 'buscar',
      termo: 'arroz',
      raioMetros: 2000,
    });
  });
});
