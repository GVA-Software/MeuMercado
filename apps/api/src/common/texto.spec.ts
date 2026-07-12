import { describe, expect, it } from 'vitest';
import { combinaBusca, semAcento } from './texto.js';

describe('semAcento', () => {
  it('remove acentos e normaliza para minúsculas', () => {
    expect(semAcento('Café')).toBe('cafe');
    expect(semAcento('AÇÚCAR')).toBe('acucar');
    expect(semAcento('  Pão de Ló  ')).toBe('pao de lo');
  });

  it('faz "café" casar com "CAFE 3 CORACOES" (busca tolerante)', () => {
    const termo = semAcento('café');
    expect(semAcento('CAFE 3 CORACOES').includes(termo)).toBe(true);
    expect(semAcento('CAFE MELITTA 500G TRAD').includes(termo)).toBe(true);
  });
});

describe('combinaBusca — acento + abreviação do cupom', () => {
  it('ignora acento e caixa nos dois sentidos', () => {
    expect(combinaBusca('CAFE 3CORACOES', 'café')).toBe(true);
    expect(combinaBusca('Café Moído', 'cafe')).toBe(true);
    expect(combinaBusca('FEIJAO KICALDO', 'feijão')).toBe(true);
  });

  it('entende abreviações: palavra inteira acha o item abreviado', () => {
    expect(combinaBusca('SAB.LIQ.PALMOLIVE', 'sabao')).toBe(true);
    expect(combinaBusca('SAB.REXONA ANTIBAC', 'sabão')).toBe(true);
    expect(combinaBusca('DET.LIQ.LIMPOL', 'detergente')).toBe(true);
    expect(combinaBusca('BISC.TRAKINAS RECH.', 'biscoito')).toBe(true);
    expect(combinaBusca('REF.SUCO PRAT', 'refrigerante')).toBe(true);
  });

  it('não casa termo vazio nem coisas não relacionadas', () => {
    expect(combinaBusca('SAB.LIQ.PALMOLIVE', '')).toBe(false);
    expect(combinaBusca('ARROZ CAMIL', 'sabao')).toBe(false);
  });
});
