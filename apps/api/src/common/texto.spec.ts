import { describe, expect, it } from 'vitest';
import { semAcento } from './texto.js';

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
