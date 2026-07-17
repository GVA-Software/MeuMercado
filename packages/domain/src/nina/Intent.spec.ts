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

  it('responde sobre o app / a Nina (ajuda)', () => {
    for (const t of [
      'o que este app faz?',
      'qual seu nome?',
      'pra que serve',
      'o que você faz?',
      'como funciona?',
    ]) {
      expect(interpretar(t).tipo).toBe('ajuda');
    }
  });

  it('perguntas sobre o HISTÓRICO de compras', () => {
    const casos: Array<[string, string]> = [
      ['qual o valor da minha última compra?', 'ultima'],
      ['qual foi a data da minha última compra?', 'ultima'],
      ['onde foi minha última compra?', 'ultima'],
      ['liste minha última compra', 'ultima'],
      ['item mais caro das minhas compras', 'mais-caro'],
      ['liste o que mais comprei', 'mais-comprado'],
      ['quanto gastei este mês?', 'gasto'],
    ];
    for (const [t, campo] of casos) {
      const r = interpretar(t);
      expect(r.tipo).toBe('historico');
      if (r.tipo === 'historico') expect(r.campo).toBe(campo);
    }
    const r = interpretar('quanto paguei na escova de dente?');
    expect(r.tipo).toBe('historico');
    if (r.tipo === 'historico') {
      expect(r.campo).toBe('gasto-produto');
      expect(r.produto).toContain('escova');
    }
  });

  it('"qual mercado pra minhas compras" continua sendo recomendação (não histórico)', () => {
    expect(interpretar('qual o melhor mercado pra fazer minhas compras hoje?').tipo).toBe(
      'melhor-mercado',
    );
  });

  it('"liste os produtos" aponta pra Preços (listar-produtos)', () => {
    expect(interpretar('liste os produtos').tipo).toBe('listar-produtos');
  });

  it('perguntas sobre a BASE comunitária (contagem + extremos)', () => {
    const c1 = interpretar('quantos itens você tem em sua base de preço?');
    expect(c1.tipo).toBe('base');
    if (c1.tipo === 'base') {
      expect(c1.campo).toBe('contagem');
      expect(c1.termo ?? '').toBe('');
    }
    const c2 = interpretar('quantos produtos de limpeza você tem?');
    expect(c2.tipo).toBe('base');
    if (c2.tipo === 'base') {
      expect(c2.campo).toBe('contagem');
      expect(c2.termo).toBe('limpeza');
    }
    const caro = interpretar('qual o produto mais caro da sua base?');
    expect(caro.tipo).toBe('base');
    if (caro.tipo === 'base') expect(caro.campo).toBe('mais-caro');
  });

  it('"quem te desenvolveu" é sobre o app (ajuda), não busca "des..." (desodorante)', () => {
    expect(interpretar('quem te desenvolveu?').tipo).toBe('ajuda');
    expect(interpretar('quem criou esse app?').tipo).toBe('ajuda');
  });

  it('"qual o mercado mais perto de mim" → listar-mercados (Mapa)', () => {
    expect(interpretar('qual o mercado mais perto de mim?').tipo).toBe('listar-mercados');
    // "qual o melhor mercado num raio de 3km" continua sendo refino (tem produto na conversa).
    expect(interpretar('qual o melhor mercado num raio de 3km perto de mim?').tipo).toBe('refinar');
  });

  it('pergunta fora de escopo → fora-de-escopo', () => {
    expect(interpretar('hoje vai chover?').tipo).toBe('fora-de-escopo');
    expect(interpretar('que horas são?').tipo).toBe('fora-de-escopo');
    expect(interpretar('está sol?').tipo).toBe('fora-de-escopo');
    expect(interpretar('faz calor hoje?').tipo).toBe('fora-de-escopo');
    // "frios" (categoria) NÃO é clima (sem "está/faz frio").
    expect(interpretar('tem frios?').tipo).not.toBe('fora-de-escopo');
  });

  it('receita/evento → montar-lista com a cesta de itens', () => {
    const r = interpretar('vou fazer um churrasco');
    expect(r.tipo).toBe('montar-lista');
    if (r.tipo === 'montar-lista') {
      expect(r.evento).toBe('churrasco');
      expect(r.itens.length).toBeGreaterThan(3);
      expect(r.itens.join(' ').toLowerCase()).toContain('carvão');
    }
    const b = interpretar('quero fazer um bolo de chocolate');
    expect(b.tipo).toBe('montar-lista');
    if (b.tipo === 'montar-lista') expect(b.evento).toBe('bolo');
    expect(interpretar('o que comprar para uma feijoada?').tipo).toBe('montar-lista');
    // "tem bolo?" (sem gatilho de fazer) continua sendo busca de produto.
    expect(interpretar('tem bolo?').tipo).toBe('buscar');
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
