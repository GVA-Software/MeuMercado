import { describe, it, expect } from 'vitest';
import { melhorNomeMercado, limparNomeMercado } from './mercado-nome.js';

describe('melhorNomeMercado', () => {
  it('rede conhecida vira a marca limpa', () => {
    expect(melhorNomeMercado(null, 'CARREFOUR COMERCIO E INDUSTRIA LTDA', 'CARREFOUR')).toBe(
      'Carrefour',
    );
    expect(melhorNomeMercado(null, 'SENDAS DISTRIBUIDORA S/A', 'ASSAI ATACADISTA')).toBe('Assaí');
    // GPA/Extra: razão é holding e o nome cru veio truncado → cai na marca "Extra"
    // quando o nome cru menciona EXTRA; senão usa a razão limpa (ver caso abaixo).
    expect(melhorNomeMercado(null, 'CIA BRASILEIRA DE DISTRIBUICAO', 'EXTRA HIPER OSASCO')).toBe(
      'Extra',
    );
  });

  it('sem marca conhecida: usa a razão social LIMPA (não a truncada)', () => {
    expect(
      melhorNomeMercado(null, 'COMPANHIA BRASILEIRA DE DISTRIBUICAO', 'CIA BRASILEIRA DE'),
    ).toBe('Cia Brasileira de Distribuicao');
  });

  it('prefere o nome fantasia quando existe (e não é rede conhecida)', () => {
    expect(melhorNomeMercado('MERCADINHO DO ZE', 'JOSE DA SILVA ME', null)).toBe(
      'Mercadinho do Ze',
    );
  });

  it('limparNomeMercado tira sufixo jurídico e ajusta maiúsculas', () => {
    expect(limparNomeMercado('SUPERMERCADO ROSSI NEW LTDA')).toBe('Supermercado Rossi New');
  });
});
