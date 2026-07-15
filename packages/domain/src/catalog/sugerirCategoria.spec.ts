import { describe, it, expect } from 'vitest';
import { sugerirCategoria } from './sugerirCategoria.js';

describe('sugerirCategoria', () => {
  const casos: Array<[string, string]> = [
    ['ARROZ CAMIL AG.T1 5Kg', 'Graos'],
    ['FEIJAO CAMIL', 'Graos'],
    ['OLEO SOJA SOYA', 'Oleos'],
    ['BISC.OREO RECH.BAUNI', 'Doces'],
    ['CHOCOLATE LACTA', 'Doces'],
    ['CHICL.TRIDENT X SEN.', 'Doces'],
    ['REF.COCA-COLA LTA 350ml', 'Bebidas'],
    ['CAFE 3CORACOES', 'Bebidas'],
    ['ACHOC PO NESCAU 900G SH', 'Bebidas'],
    ['LEITE UHT QUATA 1L INT', 'Laticinios'],
    ['MANTEIGA C SAL AVIAC', 'Laticinios'],
    ['MARGARINA QUALY C SA', 'Laticinios'],
    ['REQUEIJAO TIROLEZ', 'Laticinios'],
    ['L.COND.PIRAC.INT.TP', 'Laticinios'], // leite condensado, não condicionador
    ['LING.TOSCANA SADIA', 'Carnes'],
    ['NUGGETS FGO CQJO 30', 'Carnes'],
    ['DET.LIQ.LIMPOL', 'Limpeza'],
    ['SABONETE ...', 'Higiene'],
    ['FRALDA DESC.HUGGIES', 'Higiene'],
    ['CREME PENT.ELSEVE', 'Higiene'],
    ['MAC.ADRIA ESPAGUETE', 'Massas'],
    ['PAO FORMA PULLMAN', 'Padaria'],
    ['SAL CISNE REFINADO', 'Basicos'],
    ['FERM.DR.OETKER BIOL.', 'Basicos'],
    ['BATATA PALHA YOKI 380g', 'Basicos'], // snack, não legume fresco
    ['ATUM G.COST 170G SOL NAT', 'Conservas'],
    ['BANANA PRATA CRF KG', 'Frutas'],
    ['TOMATE SALADA UNICO', 'Legumes'],
    ['BATATA MONALISA CRFO', 'Legumes'],
    ['ALFACE ...', 'Verduras'],
    ['COPO DESC.KEROCOPO', 'Utilidades'],
    ['VELA ANIV.JUNCO Número', 'Utilidades'],
    ['ARROZ PRATO FINO T1', 'Graos'], // "PRATO" não pode roubar pra Utilidades
    ['OVOS BRANCOS JUMBO P', 'Outros'], // sem match confiável
  ];
  it.each(casos)('classifica "%s" como %s', (nome, esperado) => {
    expect(sugerirCategoria(nome)).toBe(esperado);
  });
});
