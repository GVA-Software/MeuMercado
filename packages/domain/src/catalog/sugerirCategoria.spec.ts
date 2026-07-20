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
    ['OVOS BRANCOS JUMBO P', 'Basicos'],
    ['OVO CAIPIRA DZ', 'Basicos'],
    ['OVOMALTINE 300G', 'Outros'], // "OVO" não pode vazar pra Básicos (guard do \b)
    ['CALDEIRAO HOTEL', 'Outros'], // segue ambíguo (manual)
    // Abreviações REAIS de NFC-e (nomes truncados) — o que antes caía tudo em "Outros".
    ['QJ MUSS FAT PRES150G', 'Laticinios'],
    ['MOIDA HOMOG PATIN KG', 'Carnes'],
    ['MUSCULO BOV RESF PED', 'Carnes'],
    ['BIST SUIN CG SD 800G', 'Carnes'],
    ['FILEZINHO SADIA 1KG', 'Carnes'],
    ['COU FLO RIC DAU300G', 'Verduras'],
    ['ASPARGOS VERDE DAUCY', 'Legumes'],
    ['EDAMAME SV DAUCY300G', 'Legumes'],
    ['ABACX PEROLA UNIDADE', 'Frutas'],
    ['AVOCADA GNEL KG', 'Frutas'],
    ['LAYS RUSTI S MA 108G', 'Doces'],
    ['FINISH PO 1KG', 'Limpeza'],
    ['TOALHA PAP SNOB C/2', 'Limpeza'],
    ['LIC AJAX FRESH 1L', 'Limpeza'],
    ['ENX PLAX 250ML', 'Higiene'],
    ['WRAP RAP 10 INTEG', 'Padaria'],
    ['ALECRIN KITANO 6G', 'Basicos'],
    // Abreviações da Onda 2 (Assaí/Atacadão/Armarinhos) — antes caíam em "Outros".
    ['SACOLINHA BIOP 48X55', 'Utilidades'],
    ['AC ORG ITAJA 1kg', 'Basicos'],
    ['ALC TUPI 46 ZERO 1L', 'Limpeza'],
    ['ARR CAMIL LF T1 5kg', 'Graos'],
    ['C ARISCO 114G GAL', 'Basicos'],
    ['COCO SECO kg', 'Basicos'],
    ['CORTADOR DE UNHA MUNDIA', 'Utilidades'],
    ['DEL VALLE FRUT 1.5L', 'Bebidas'],
    ['EMBL.ALUM.D6 WYDA', 'Utilidades'],
    ['JABA EM MANTA', 'Carnes'],
    ['LAMP.12WS.LED OUROL', 'Utilidades'],
    ['LAMP.50W OUROLUX', 'Utilidades'],
    ['MANT TOUR PT CS 500G', 'Laticinios'],
    ['MAS.PASTEL MASSA LEV 2kg', 'Massas'],
    ['MASSA DE TAPIOCA', 'Basicos'],
    ['MOST CEPERA 200G AMA', 'Basicos'],
    ['P AL BOMPACK 30X7,5M', 'Utilidades'],
    ['P O RUSTICO TRADICIO', 'Padaria'],
    ['PEITO FGO S OSSO KG', 'Carnes'],
    // Guards de falso-positivo das abreviações novas:
    ['ALCATRA BOV RESF KG', 'Carnes'], // ALC\b não rouba alcatra pra Limpeza
    ['MANTA DE JABA', 'Carnes'], // MANT\b não pega "MANTA" (segue Carnes por JABA)
  ];
  it.each(casos)('classifica "%s" como %s', (nome, esperado) => {
    expect(sugerirCategoria(nome)).toBe(esperado);
  });
});
