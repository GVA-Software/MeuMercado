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

  it('"qual o melhor mercado para [X]" vira recomendação de mercado', () => {
    const r = interpretar('Hoje qual o melhor mercado para comprar produtos de limpeza?');
    expect(r.tipo).toBe('melhor-mercado');
    if (r.tipo === 'melhor-mercado') expect(r.termo).toContain('limpeza');
    // Sem mencionar "mercado", continua sendo busca de produto (escolher tipo).
    expect(interpretar('produtos de limpeza').tipo).toBe('buscar');
  });

  it('recomendação GENÉRICA (sem produto específico) → termo null (avalia a base toda)', () => {
    const r1 = interpretar('qual o melhor mercado pra fazer minhas compras hoje?');
    expect(r1.tipo).toBe('melhor-mercado');
    if (r1.tipo === 'melhor-mercado') expect(r1.termo).toBeNull();

    const r2 = interpretar('qual o melhor mercado?');
    expect(r2.tipo).toBe('melhor-mercado');
    if (r2.tipo === 'melhor-mercado') expect(r2.termo).toBeNull();

    const r3 = interpretar('onde fazer a feira do mês?');
    expect(r3.tipo).toBe('melhor-mercado');
    if (r3.tipo === 'melhor-mercado') expect(r3.termo).toBeNull();

    // Com produto específico, NÃO é genérica — mantém o termo.
    const r4 = interpretar('qual o melhor mercado pra café?');
    expect(r4.tipo).toBe('melhor-mercado');
    if (r4.tipo === 'melhor-mercado') expect(r4.termo).toBe('cafe');
  });

  it('reconhece despedida', () => {
    for (const t of ['tchau', 'falou', 'até mais', 'até logo', 'adeus']) {
      expect(interpretar(t).tipo).toBe('despedida');
    }
  });

  it('lista de produtos (cesta) vira recomendação de mercado, mesmo sem "mercado"', () => {
    const r = interpretar('arroz, feijão, óleo');
    expect(r.tipo).toBe('melhor-mercado');
    if (r.tipo === 'melhor-mercado') expect(r.termo).toBe('arroz, feijao, oleo');

    const r2 = interpretar('quero comprar leite e ovos');
    expect(r2.tipo).toBe('melhor-mercado');
    if (r2.tipo === 'melhor-mercado') expect(r2.termo).toBe('leite, ovos');

    // Um produto só (com conector interno "de") continua sendo busca.
    expect(interpretar('pão de forma').tipo).toBe('buscar');
  });

  it('"quais mercados (plural) perto de mim" → listar-mercados (manda pro Mapa)', () => {
    expect(interpretar('quais mercados perto de mim?').tipo).toBe('listar-mercados');
    expect(interpretar('mercados perto de mim').tipo).toBe('listar-mercados');
    // Singular "qual o melhor mercado?" NÃO é listar (é recomendação).
    expect(interpretar('qual o melhor mercado?').tipo).toBe('melhor-mercado');
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
