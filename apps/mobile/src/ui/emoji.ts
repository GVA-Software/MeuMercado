/**
 * Emoji automático para um produto a partir do nome (a NFC-e traz abreviações em
 * caixa alta, ex.: "PRES.MAG.COZ.SEARA"). Heurística leve e 100% local — sem
 * custo de API. Usada como fallback quando o produto não tem emoji próprio.
 *
 * A ORDEM importa: regras mais específicas/compostas vêm antes das genéricas, para
 * "molho de tomate" virar 🍅 (não 🫙), "chocolate ao leite" 🍫 (não 🥛),
 * "batata doce" 🍠 (não 🥔), "pimentão" 🫑 (não 🌶️) etc.
 */

function normaliza(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.\-_/(),]/g, ' ')
    .replace(/\s+/g, ' ');
}

/** [palavras-chave, emoji] — a primeira que casar (substring) vence. */
const REGRAS: Array<[readonly string[], string]> = [
  // ---------- Casa / limpeza / utilidades (raramente colidem com comida) ----------
  [['saco de lixo', 'saco lixo', 'embalixo', 'pa de lixo', 'saco p lixo', 'saco para lixo'], '🗑️'],
  [['papel higien'], '🧻'],
  [['papel toalha', 'papel aluminio', 'papel alumin ', 'filme pvc', 'filme plastico', 'papel manteiga'], '🧻'],
  [['guardanapo'], '🍽️'],
  [['saco zip', 'saco ziploc', 'saco para freezer', 'saco freezer', 'sacola', 'saco de compras'], '🛍️'],
  [['prendedor'], '📎'],
  [['fosforo', 'isqueiro'], '🔥'],
  [['velas', 'vela perfum', 'vela aromat', 'vela de'], '🕯️'],
  [['pilha', 'bateria'], '🔋'],
  [['lampada'], '💡'],
  [['inseticida', 'formicida', 'barata'], '🪳'],
  [['repelente', 'mosquito'], '🦟'],
  [['esponja de aco', 'esponja aco', 'bombril'], '🧽'],
  [['esponja'], '🧽'],
  [['vassoura', 'rodo'], '🧹'],
  [['pano de chao', 'pano multiuso', 'pano de prato', 'balde', 'flanela'], '🪣'],
  [['luva'], '🧤'],
  [['sabao em po', 'sabao po'], '🧼'],
  [['agua sanitaria', 'agua sanit', 'candida'], '🧴'],
  [
    ['amaciante', 'detergente', 'desengordur', 'multiuso', 'desinfet', 'limpa vidro', 'limpador', 'tira mancha', 'alvejante', 'lustra', 'cera liquida', 'sabao liquido', 'sabao'],
    '🧴',
  ],

  // ---------- Higiene pessoal / beleza ----------
  [['creme dental', 'pasta de dente', 'pasta dental', 'gel dental'], '🪥'],
  [['escova de dente', 'escova dental'], '🪥'],
  [['fio dental'], '🦷'],
  [['aparelho de barbear', 'gilete', 'lamina de barbear'], '🪒'],
  [['algodao'], '⚪'],
  [['cotonete', 'haste flexivel'], '🧴'],
  [['sabonete liquido'], '🧴'],
  [['sabonete'], '🧼'],
  [
    ['shampoo', 'xampu', 'condicionador', 'creme para pentear', 'creme pentear', 'enxaguante', 'antisseptico bucal', 'desodorante', 'hidratante', 'protetor solar', 'pos barba', 'espuma de barb', 'talco', 'pomada', 'perfume', 'colonia', 'locao'],
    '🧴',
  ],
  [['batom'], '💄'],
  [['delineador'], '✏️'],
  [['sombra ', 'sombra p'], '🎨'],
  [['esmalte'], '💅'],
  [['corretivo', 'po compacto', 'blush', 'mascara de cilios', 'rimel', 'base facial', ' base ', 'primer', 'mascara facial', 'creme facial', 'serum facial'], '🧴'],

  // ---------- Bebê ----------
  [['fralda', 'lenco umedecido', 'lencos umedecidos'], '👶'],
  [['mamadeira', 'chupeta'], '🍼'],
  [['papinha'], '🥣'],
  [['formula infantil', 'leite em po infantil'], '🥛'],
  [['shampoo infantil', 'talco infantil'], '🧴'],
  [['sabonete infantil'], '🧼'],

  // ---------- Pet ----------
  [['racao para gato', 'racao gato', 'racao gatos', 'sache para gato', 'sache gato', 'areia sanit', 'areia para gato', 'arranhador'], '🐱'],
  [['racao para cao', 'racao para caes', 'racao cao', 'racao caes', 'racao'], '🐶'],
  [['petisco', 'bifinho', 'osso para'], '🦴'],
  [['coleira', 'guia peitoral'], '🦮'],
  [['tapete higienico'], '🟦'],
  [['brinquedo'], '🧸'],
  [['sache'], '🥫'],

  // ---------- Açougue / frios / peixaria (compostos primeiro) ----------
  [['pao de queijo'], '🧀'],
  [['requeijao'], '🧀'],
  [['queijo', 'mussarela', 'mucarela', 'muzarela', 'parmesao', 'provolone', 'gorgonzola', 'cheddar', 'catupiry'], '🧀'],
  // chocolate cedo para vencer "leite" em "chocolate ao leite"
  [['chocolate', 'bombom', 'brigadeiro', 'nutella', 'chocotone'], '🍫'],
  [['presunt', 'apresunt', 'pres mag', 'mortadela', 'salame', 'peito de peru', 'blanquet'], '🍖'],
  [['linguica', 'salsich'], '🌭'],
  [['bacon', 'toucinho', 'panceta'], '🥓'],
  [['hamburguer', 'hamburg'], '🍔'],
  [['frango', 'coxa', 'sobrecoxa', 'peito de frango', 'file de frango', 'asa de frango'], '🍗'],
  [['costela'], '🍖'],
  [
    ['carne', 'bife', 'patinho', 'acem', 'coxao', 'alcatra', 'picanha', 'moida', 'musculo', 'file mignon', 'contra file', 'cupim', 'fraldinha', 'maminha', 'pernil', 'lombo'],
    '🥩',
  ],
  [['camarao'], '🦐'],
  [['lula'], '🦑'],
  [['polvo'], '🐙'],
  [['mexilhao', 'marisco', 'ostra'], '🦪'],
  [['caranguejo', 'siri'], '🦀'],
  [['peixe', 'sardinha', 'atum', 'tilapia', 'merluza', 'bacalhau', 'salmao', 'pescada'], '🐟'],
  [['ovos', ' ovo '], '🥚'],

  // ---------- Laticínios ----------
  [['leite condensado'], '🥛'],
  [['creme de leite'], '🥛'],
  [['doce de leite'], '🍮'],
  [['iogurte', 'nescau', 'achocolatado', 'toddy'], '🥛'],
  [['manteiga', 'margarina'], '🧈'],
  [['leite'], '🥛'],

  // ---------- Padaria ----------
  [['baguete'], '🥖'],
  [['croissant'], '🥐'],
  [['rosquinha', 'donut', 'sonho'], '🍩'],
  [['bolo', 'panetone', 'torta', ' cuca '], '🎂'],
  [['torrada'], '🍞'],
  [['pao', 'bisnaga'], '🍞'],

  // ---------- Mercearia: grãos, massas, farinhas ----------
  [['arroz'], '🍚'],
  [['feijao', 'lentilha', 'grao de bico'], '🫘'],
  [['ervilha'], '🫛'],
  [['canjica'], '🌽'],
  [['miojo', 'macarrao instant', 'lamen', 'ramen'], '🍜'],
  [['macarrao', 'espaguete', 'espaguet', 'penne', 'parafuso', 'talharim', 'lasanha', 'nhoque', 'massa '], '🍝'],
  [['fuba'], '🌽'],
  [['farinha', 'trigo', 'amido de milho', 'polvilho', 'aveia', 'tapioca', 'goma'], '🌾'],

  // ---------- Óleos e molhos ----------
  [['azeite', 'azeitona'], '🫒'],
  [['extrato de tomate', 'molho de tomate', 'molho tomate', 'polpa de tomate', 'tomate pelado', 'tomate'], '🍅'],
  [['molho de alho'], '🧄'],
  [['molho de pimenta'], '🌶️'],
  [['oleo', 'banha'], '🫙'],
  [['vinagre', 'shoyu', 'molho ingles', 'barbecue', 'ketchup', 'catchup', 'mostarda', 'maionese', 'molho', 'tempero', 'caldo '], '🫙'],

  // ---------- Enlatados ----------
  [['palmito', 'seleta', 'cogumelo', 'champignon'], '🥫'],

  // ---------- Doces ----------
  [['pirulito'], '🍭'],
  [['marshmallow'], '🍡'],
  [['pacoca', 'pe de moleque', 'amendoim'], '🥜'],
  [['geleia'], '🫙'],
  [['goiabada', 'bala', 'chiclete', 'jujuba', 'caramelo'], '🍬'],
  [['mel ', 'mel de', 'mel silvestre', 'mel puro'], '🍯'],

  // ---------- Snacks ----------
  [['batata chips', 'batata palha', 'chips'], '🥔'],
  [['salgadinho', 'salgadin', 'doritos', 'cheetos', 'fandangos'], '🍟'],
  [['pipoca'], '🍿'],
  [['castanha', 'noz ', 'nozes', 'amendoa', 'avela'], '🌰'],
  [['barra de cereal'], '🥣'],
  [['cereal', 'granola', 'sucrilhos', 'flocos de milho'], '🥣'],
  [['biscoito', 'bolacha', 'cookie', 'wafer', 'waffer'], '🍪'],

  // ---------- Bebidas ----------
  [['agua de coco', 'coco'], '🥥'],
  [['agua com gas', 'agua mineral', 'agua '], '💧'],
  [['refrigerante', 'coca', 'guarana', 'fanta', 'sprite', 'pepsi', 'soda', 'tonica'], '🥤'],
  [['suco', 'nectar'], '🧃'],
  [['cafe'], '☕'],
  [['cha verde', 'cha preto', 'cha mate', 'cha branco', 'cha de', 'camomila', 'erva mate'], '🍵'],
  [['energetico', 'isotonico', 'gatorade', 'red bull', 'redbull'], '🥤'],
  [['cerveja', 'chopp'], '🍺'],
  [['vinho', 'espumante'], '🍷'],
  [['cachaca', 'vodka', 'whisky', 'gin ', 'licor', 'tequila'], '🍸'],

  // ---------- Hortifrúti: frutas ----------
  [['maca verde'], '🍏'],
  [['maca', 'maça'], '🍎'],
  [['banana'], '🍌'],
  [['laranja', 'mexerica', 'tangerina', 'bergamota'], '🍊'],
  [['limao'], '🍋'],
  [['uva'], '🍇'],
  [['morango'], '🍓'],
  [['mirtilo', 'amora', 'framboesa', 'blueberry'], '🫐'],
  [['melancia'], '🍉'],
  [['melao', 'mamao'], '🍈'],
  [['manga'], '🥭'],
  [['abacaxi'], '🍍'],
  [['kiwi'], '🥝'],
  [['pessego', 'nectarina'], '🍑'],
  [['abacate'], '🥑'],
  [['ameixa', 'figo', 'jabuticaba'], '🟣'],
  [['caqui'], '🟠'],
  [['goiaba'], '🟢'],
  [['maracuja'], '🟡'],

  // ---------- Hortifrúti: verduras ----------
  [['couve flor', 'brocolis'], '🥦'],
  [
    ['alface', 'couve', 'rucula', 'agriao', 'espinafre', 'repolho', 'acelga', 'chicoria', 'escarola', 'salsa', 'cebolinha', 'coentro', 'manjericao', 'salada', 'cheiro verde', 'verdura'],
    '🥬',
  ],

  // ---------- Hortifrúti: legumes ----------
  [['batata doce', 'batata-doce'], '🍠'],
  [['batata', 'mandioca', 'aipim', 'inhame'], '🥔'],
  [['cenoura'], '🥕'],
  [['beterraba'], '🟣'],
  [['pepino', 'abobrinha', 'chuchu'], '🥒'],
  [['berinjela'], '🍆'],
  [['abobora', 'moranga', 'jerimum'], '🎃'],
  [['pimentao'], '🫑'],
  [['pimenta'], '🌶️'],
  [['cebola'], '🧅'],
  [['alho'], '🧄'],
  [['milho'], '🌽'],

  // ---------- Básicos ----------
  [['acucar'], '🍬'],
  [[' sal ', 'sal refinado', 'sal grosso', 'sal marinho'], '🧂'],
];

export function emojiParaProduto(nome: string): string {
  const n = ` ${normaliza(nome)} `;
  for (const [chaves, emoji] of REGRAS) {
    for (const c of chaves) if (n.includes(c)) return emoji;
  }
  return '📦';
}

/** Emoji do produto: o próprio (catálogo) ou um inferido pelo nome. */
export function emojiDe(p: { emoji?: string | null | undefined; nome: string }): string {
  return p.emoji || emojiParaProduto(p.nome);
}
