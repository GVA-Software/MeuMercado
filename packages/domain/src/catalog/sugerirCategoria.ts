import type { Categoria } from './Categoria.js';

/**
 * Sugere a categoria de um produto pelo NOME (heurística por palavras-chave).
 * Usado pra classificar em lote os itens que entram como "Outros" (a NFC-e não
 * categoriza). A ordem das regras importa: marcas/sabores (bebida, doce) são
 * checados ANTES de frutas/legumes pra "SUCO ... MORANGO" não virar Fruta.
 * Retorna 'Outros' quando não há match confiável.
 */
export function sugerirCategoria(nome: string): Categoria {
  const n = ' ' + String(nome).toUpperCase().replace(/[.,/]/g, ' ') + ' ';
  const h = (re: RegExp): boolean => re.test(n);
  // Leite condensado ("L.COND") antes de Higiene (condicionador) e de Bebidas.
  if (h(/\b(?:L COND|LEITE COND|LEITE MOCA|\bMOCA\b)/)) return 'Laticinios';
  if (
    h(
      /\b(?:COPO|GUARDANAP|GUARD |FILME|PVC|VELA|BALAO|CHUPETA|CHOCALHO|MAMADEIRA|FILTRO PAPEL|INTERFOLHA|POTE|TALHER|GARFO|PALITO|FOSFORO|PILHA|LAMPADA|ARRANJO|PRATO FUND|PRATO RAS|PRATO DESC|PRATO BR|PRATO SOB|PRATOS|CJ )/,
    )
  )
    return 'Utilidades';
  if (
    h(
      /\b(?:REFR|REFRIG|REF\b|SUCO|AGUA|CERVEJA|CAFE|CHA\b|ENERG|RED BULL|NESCAU|ACHOC|TODDY|GATORADE|POWERADE|ISOTON|ISOTO|VINHO|TANG|SUKITA|COCA|GUARANA|FANTA|KUAT|BEB MIST|BEB LAC)/,
    )
  )
    return 'Bebidas';
  if (
    h(
      /\b(?:BISC|BOLACHA|OREO|TRAKINAS|TRIDENT|PASSATEM|NEGRESC|WAFER|COOKIE|BOMBOM|BALA|PIRULITO|CHICL|GOMA|MENTOS|HALLS|TIC TAC|CEREAL|CER MAT|GELATINA|PACOCA|MARSHM|CONF |COBERT|SALG|CHIPS|FOFURA|CHOCOLATE|WILD)/,
    ) ||
    h(/\bCHOC(?!ALHO)/)
  )
    return 'Doces';
  if (
    h(
      /\b(?:SABONETE|SAB LIQ|SHAMP|CONDIC|CREME DENT|CR DENT|CRM DENT|PAPEL HIG|P HIG|DESOD|DES\b|ABSORV|ABS\b|FRALD|LENCO|HASTE|COTONE|COTON|ESCOVA DENT|ESC DENT|ANTISSEP|PLAX|GILLET|BARBEAR|AP BARB|VENUS|PRESTO|ALGODAO|DEPIL|ASSADURA|CREME PENT|SEDA|ELSEVE|NIVEA|REXONA|HERBISS)/,
    )
  )
    return 'Higiene';
  if (
    h(
      /\b(?:DET\b|DETERG|SABAO|SAPON|SAPOL|AMAC|DESINF|SANIT|LIMP|VEJA|LIXO|ESPONJA|BOMBRIL|LA DE ACO|CLORO|LUSTRA|ALVEJ|MULTIUSO|PATO|HARPIC|YPE|VANISH|VANIS|OMO|TIRA MANCHA|PEDRA SANIT|DIFUSOR|INSET|RAID|BLOCO SANIT)/,
    )
  )
    return 'Limpeza';
  if (
    h(
      /\b(?:LEITE|LTE\b|IOG|QUEIJO|QJO|MUSSAR|REQUEIJ|REQ\b|MANTEIG|MARGAR|MARG\b|CREME LEITE|CR LEITE|NATA|DANONE|POLENGH|CATUPIRY|COALHAD|GREGO|YAKULT|NESTOG)/,
    )
  )
    return 'Laticinios';
  if (
    h(
      /\b(?:CARNE|FRANGO|LING|LINGUIC|BACON|SALSICH|HOT DOG|PRESUNT|APRESUNT|MORTAD|SALAME|SALAMIT|HAMBURG|PEIXE|SALMAO|TILAPIA|FILE|COSTELA|PICANHA|NUGGET|PIZZA|SEARA|SADIA SAL)/,
    )
  )
    return 'Carnes';
  if (h(/\b(?:OLEO|AZEITE|GORDURA)/)) return 'Oleos';
  if (h(/\b(?:MAC\b|MACARR|LASANHA|NHOQUE|MIOJO|LAMEN|TALHARIM|ESPAGUETE|PARAFUSO)/))
    return 'Massas';
  if (h(/\b(?:PAO|BISNAG|TORRADA|ROSCA|BOLO|MIST BOL|M BOLO|MISTBOL|COF BOLO|PANETON|CROISS)/))
    return 'Padaria';
  if (
    h(
      /\b(?:ACUCAR|ACUC|ACU |SAL\b|FARINHA|FAR\b|FUBA|POLVILHO|AMIDO|MAIZENA|FERM|EXTRATO|MOLHO|TEMPERO|SAZON|CALDO|MAION|KETCHUP|MOSTARDA|VINAGRE|CANELA|OREGANO|COLORIF|SHOYU|FAROFA|PIPOCA|COCO FLOCO|COCO RALADO|PALHA)/,
    )
  )
    return 'Basicos';
  if (h(/\b(?:MILHO|ERVILHA|SELETA|ATUM|SARDINHA|AZEITON|PALMITO|CONSERV)/)) return 'Conservas';
  if (
    h(
      /\b(?:BANANA|MACA\b|LARANJA|UVA\b|MAMAO|MELANC|ABACAX|MANGA|PERA\b|LIMAO|MORANGO|KIWI|MELAO|ABACATE|CAQUI|GOIABA|TANGERI|PONKAN|ATEMOYA)/,
    )
  )
    return 'Frutas';
  if (
    h(
      /\b(?:TOMATE|CENOURA|BATATA|CEBOLA|ABOBRINHA|ABOBORA|PIMENTAO|BERINJELA|CHUCHU|BETERRABA|MANDIOCA|MANDIOQUINHA|ALHO|VAGEM|QUIABO|PEPINO)/,
    )
  )
    return 'Legumes';
  if (
    h(
      /\b(?:ALFACE|COUVE|RUCULA|ESPINAFRE|COENTRO|SALSA|CEBOLINHA|AGRIAO|BROCOLIS|ACELGA|REPOLHO|HORT)/,
    )
  )
    return 'Verduras';
  if (h(/\b(?:ARROZ|FEIJAO|FEIJ|LENTILHA|GRAO DE BICO)/)) return 'Graos';
  return 'Outros';
}
