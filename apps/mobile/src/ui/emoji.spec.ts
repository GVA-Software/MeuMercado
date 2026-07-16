import { describe, it, expect } from 'vitest';
import { emojiParaProduto, emojiDe } from './emoji';

describe('emojiParaProduto', () => {
  it('reconhece abreviações da NFC-e com emoji específico', () => {
    expect(emojiParaProduto('AVOCADA GNEL KG')).toBe('🥑');
    expect(emojiParaProduto('ABACX PEROLA UNIDADE')).toBe('🍍');
    expect(emojiParaProduto('COU FLO RIC DAU300G')).toBe('🥦');
    expect(emojiParaProduto('LAYS RUSTI S MA 108G')).toBe('🍟');
    expect(emojiParaProduto('WRAP RAP 10 INTEG')).toBe('🌯');
    expect(emojiParaProduto('TOALHA PAP SNOB C/2')).toBe('🧻');
    expect(emojiParaProduto('MOIDA HOMOG PATIN KG')).toBe('🥩');
  });

  it('cai na CATEGORIA quando o nome não casa (não fica 📦)', () => {
    expect(emojiParaProduto('EDAMAME SV DAUCY300G', 'Legumes')).toBe('🥕');
    expect(emojiParaProduto('QJ MUSS FAT PRES150G', 'Laticinios')).toBe('🧀');
    expect(emojiParaProduto('FINISH PO 1KG', 'Limpeza')).toBe('🧽');
    expect(emojiParaProduto('ENX PLAX 250ML', 'Higiene')).toBe('🧴');
  });

  it("sem categoria reconhecível, ou 'Outros', fica no 📦", () => {
    expect(emojiParaProduto('QA ERV S/ SODIO 170G', 'Outros')).toBe('📦');
    expect(emojiParaProduto('XPTO INDECIFRAVEL')).toBe('📦');
  });

  it('emojiDe prefere o emoji do catálogo, senão infere', () => {
    expect(emojiDe({ emoji: '🎯', nome: 'QUALQUER' })).toBe('🎯');
    expect(emojiDe({ nome: 'BANANA PRATA' })).toBe('🍌');
    expect(emojiDe({ nome: 'ASPARGOS VERDE', categoria: 'Legumes' })).toBe('🥕');
  });
});
