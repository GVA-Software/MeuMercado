import { describe, expect, it } from 'vitest';
import { combinaBusca, semAcento } from './busca.js';

describe('semAcento', () => {
  it('remove acentos e normaliza para minúsculas', () => {
    expect(semAcento('Café')).toBe('cafe');
    expect(semAcento('Pão')).toBe('pao');
    expect(semAcento('AÇÚCAR')).toBe('acucar');
  });
});

describe('combinaBusca — acento + abreviação do cupom', () => {
  it('ignora acento e caixa nos dois sentidos', () => {
    expect(combinaBusca('CAFE 3CORACOES', 'café')).toBe(true);
    expect(combinaBusca('Café Moído', 'cafe')).toBe(true);
    expect(combinaBusca('PAO FRANCES Kg', 'pão')).toBe(true); // caso do print
    expect(combinaBusca('FEIJAO KICALDO', 'feijão')).toBe(true);
  });

  it('entende abreviações: palavra inteira acha o item abreviado', () => {
    expect(combinaBusca('SAB.LIQ.PALMOLIVE', 'sabao')).toBe(true);
    expect(combinaBusca('SAB.REXONA ANTIBAC', 'sabão')).toBe(true);
    expect(combinaBusca('DET.LIQ.LIMPOL', 'detergente')).toBe(true);
    expect(combinaBusca('BISC.TRAKINAS RECH.', 'biscoito')).toBe(true);
    expect(combinaBusca('REF.SUCO PRAT', 'refrigerante')).toBe(true);
  });

  it('mantém a precisão: não casa termo vazio nem coisas não relacionadas', () => {
    expect(combinaBusca('SAB.LIQ.PALMOLIVE', '')).toBe(false);
    expect(combinaBusca('ARROZ CAMIL', 'sabao')).toBe(false);
    // "REF." de açúcar REFinado não deve casar com "refrigerante"
    expect(combinaBusca('ACUC.REF.UNIAO', 'refrigerante')).toBe(false);
  });
});
