/**
 * Emoji automático para um produto a partir do nome. A NFC-e traz abreviações em
 * caixa alta (ex.: "SAB.LIQ.LUX", "DES.REXONA", "CR.DENTAL", "AMAC.YPE"), então o
 * dicionário reconhece tanto o nome completo quanto as abreviações comuns.
 * Heurística leve e 100% local — sem custo de API.
 *
 * A ORDEM importa: regras compostas/específicas vêm antes das genéricas, e o nome
 * é envolto por espaços para casar limites de palavra (ex.: " sal " não casa
 * "salsicha"; " alho " não casa "chocalho").
 */

function normaliza(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.\-_/(),=]/g, ' ')
    .replace(/\s+/g, ' ');
}

/** [palavras-chave, emoji] — a primeira que casar (substring) vence. */
const REGRAS: Array<[readonly string[], string]> = [
  // ---------- Casa / limpeza / descartáveis ----------
  [['saco de lixo', 'saco lixo', 'sac lixo', 'sac inst', 'embalixo', 'pa de lixo', 'saco p lixo', 'saco para lixo'], '🗑️'],
  [['papel higien', 'papel hig', 'p hig'], '🧻'],
  [['papel toalha', 'papel aluminio', 'papel alumin', 'filme pvc', 'filme de pvc', 'filme', 'pvc', 'papel manteiga', 'interfolha'], '🧻'],
  [['absorvente', 'abs '], '🧻'],
  [['guardanapo'], '🍽️'],
  [['prato fundo', 'prato raso', 'prato sobrem', 'prato desc', 'prato de papel'], '🍽️'],
  [['copo'], '🥤'],
  [['talher', 'garfo desc', 'faca desc', 'colher desc'], '🍴'],
  [['caldeirao', 'panela', 'frigideira', 'frigid', 'wok'], '🍲'],
  [['saco zip', 'saco ziploc', 'saco para freezer', 'saco freezer', 'sacola', 'saco de compras'], '🛍️'],
  [['prendedor'], '📎'],
  [['fosforo', 'isqueiro'], '🔥'],
  [['velas', 'vela perfum', 'vela aromat', 'vela de'], '🕯️'],
  [['pilha', 'bateria'], '🔋'],
  [['lampada'], '💡'],
  [['inseticida', 'inset ', 'formicida', 'barata', 'raid'], '🪳'],
  [['repelente', 'mosquito'], '🦟'],
  [['esponja de aco', 'esponja aco', 'bombril'], '🧽'],
  [['esponja'], '🧽'],
  [['vassoura', 'rodo'], '🧹'],
  [['pano de chao', 'pano multiuso', 'pano de prato', 'balde', 'flanela'], '🪣'],
  [['luva'], '🧤'],
  [['sabao em po', 'sabao po'], '🧼'],
  [['agua sanitaria', 'agua sanit', 'candida'], '🧴'],
  [
    ['amaciante', 'amac', 'detergente', 'det ', 'desengordur', 'multiuso', 'multi uso', 'desinfet', 'desinf', 'desifet', 'des ', 'desod', 'limpa vidro', 'limpador', 'limp ', 'tira mancha', 'alvejante', 'lustra', 'cera liquida', 'sabao liquido', 'sab liq', 'sabao', 'lava r', 'lava rpa', 'lava roupa', 'pedra sanit', 'bloco sanit', 'past ades', 'pastilha ades', 'pastilha sanit', 'antissep', 'difusor', 'aromatiz', 'cloro', 'saponaceo', 'sapolio', 'agua sanit'],
    '🧴',
  ],

  // ---------- Higiene pessoal / beleza ----------
  [['creme dental', 'cr dental', 'cr dent', 'crm dent', 'crm dental', 'gel dental', 'gel d sorriso', 'pasta de dente', 'pasta dental'], '🪥'],
  [['escova de dente', 'escova dental', 'esc dental', 'esc dent'], '🪥'],
  [['fio dental'], '🦷'],
  [['aparelho de barbear', 'ap barb', 'apar barb', 'gilete', 'lamina de barbear'], '🪒'],
  [['algodao'], '⚪'],
  [['cotonete', 'haste'], '🧴'],
  [['sabonete liquido'], '🧴'],
  [['sabonete', 'sab '], '🧼'],
  [
    ['shampoo', 'shamp', 'xampu', 'xamp', 'condicionador', 'cond seda', 'cond dove', 'cond elseve', 'cond pantene', 'cond clear', 'cond nivea', 'creme pent', 'creme para pentear', 'enxaguante', 'antisseptico bucal', 'desodorante', 'hidratante', 'protetor solar', 'pos barba', 'espuma de barb', 'talco', 'pomada', 'perfume', 'colonia', 'locao'],
    '🧴',
  ],
  [['batom'], '💄'],
  [['delineador'], '✏️'],
  [['sombra ', 'sombra p'], '🎨'],
  [['esmalte'], '💅'],
  [['corretivo', 'po compacto', 'blush', 'mascara de cilios', 'rimel', 'base facial', ' base ', 'primer', 'mascara facial', 'creme facial', 'serum facial'], '🧴'],

  // ---------- Bebê ----------
  [['fralda', 'lenco umedecido', 'lencos umedecidos', 'toalha ume', 'toalha umed', 'assadura'], '👶'],
  [['chocalho'], '🧸'],
  [['mamadeira', 'chupeta'], '🍼'],
  [['papinha'], '🥣'],
  [['formula infantil', 'leite em po infantil'], '🥛'],
  [['shampoo infantil', 'talco infantil'], '🧴'],
  [['sabonete infantil'], '🧼'],

  // ---------- Pet ----------
  [['racao para gato', 'racao gato', 'racao gatos', 'sache para gato', 'sache gato', 'areia sanit', 'arranhador'], '🐱'],
  [['racao para cao', 'racao para caes', 'racao cao', 'racao caes', 'racao'], '🐶'],
  [['petisco', 'bifinho', 'osso para', 'sache para cao', 'sache cachorro'], '🦴'],
  [['coleira', 'guia peitoral'], '🦮'],
  [['tapete higienico'], '🟦'],
  [['brinquedo'], '🧸'],

  // ---------- Açougue / frios / peixaria ----------
  [['pao de queijo'], '🧀'],
  [['requeijao', 'req '], '🧀'],
  [['queijo', 'qjo', 'mussarela', 'mucarela', 'muzarela', 'parmesao', 'provolone', 'gorgonzola', 'cheddar', 'catupiry'], '🧀'],
  [['chocolate', 'bombom', 'brigadeiro', 'nutella', 'chocotone'], '🍫'],
  [['presunt', 'apresunt', 'pres mag', 'mortadela', 'salame', 'peito de peru', 'blanquet'], '🍖'],
  [['linguica', 'ling ', 'salsich'], '🌭'],
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
  [['leite condensado', 'leite cond', 'l cond', 'cond pirac', 'cond moca', 'condensado'], '🥛'],
  [['creme de leite', 'cr leite'], '🥛'],
  [['doce de leite'], '🍮'],
  [['iogurte', 'iog ', 'danone', 'grego', 'nescau', 'achocolatado', 'achoc', 'toddy', 'beb lac', 'bebida lactea', 'leite ferm'], '🥛'],
  [['manteiga', 'margarina', 'marg '], '🧈'],
  [['leite'], '🥛'],

  // ---------- Padaria ----------
  [['baguete'], '🥖'],
  [['croissant'], '🥐'],
  [['rosquinha', 'donut', 'sonho'], '🍩'],
  [['bolo', 'mist bol', 'panetone', 'torta', ' cuca '], '🎂'],
  [['torrada'], '🍞'],
  [['pao', 'bisnaga'], '🍞'],

  // ---------- Mercearia: grãos, massas, farinhas ----------
  [['arroz'], '🍚'],
  [['feijao', 'lentilha', 'grao de bico'], '🫘'],
  [['ervilha'], '🫛'],
  [['canjica'], '🌽'],
  [['pizza'], '🍕'],
  [['miojo', 'macarrao instant', 'lamen', 'ramen'], '🍜'],
  [['macarrao', 'mac ', 'espaguete', 'espaguet', 'penne', 'parafuso', 'talharim', 'lasanha', 'nhoque', 'massa '], '🍝'],
  [['farinha', 'farofa', 'trigo', 'amido de milho', 'polvilho', 'aveia', 'tapioca', 'goma de tapioca', 'ferm ', 'fermento'], '🌾'],
  [['fuba'], '🌽'],

  // ---------- Óleos e molhos ----------
  [['azeite', 'azeitona'], '🫒'],
  [['extrato de tomate', 'molho de tomate', 'molho tomate', 'molho tom', 'polpa de tomate', 'tomate pelado', 'tomate'], '🍅'],
  [['molho de alho'], '🧄'],
  [['molho de pimenta'], '🌶️'],
  [['oleo', 'banha'], '🫙'],
  [['vinagre', 'shoyu', 'molho ingles', 'barbecue', 'ketchup', 'catchup', 'mostarda', 'maionese', 'maion', 'molho', 'tempero', 'temp ', 'oregano', 'caldo '], '🫙'],

  // ---------- Enlatados ----------
  [['palmito', 'seleta', 'cogumelo', 'champignon'], '🥫'],

  // ---------- Doces ----------
  [['pirulito'], '🍭'],
  [['marshmallow'], '🍡'],
  [['pacoca', 'pe de moleque', 'amendoim'], '🥜'],
  [['geleia'], '🫙'],
  [['gelatina'], '🍮'],
  [['goiabada', 'bala', 'chiclete', 'chicl', 'goma mascar', 'goma de mascar', 'jujuba', 'caramelo', 'pastilha'], '🍬'],
  [['mel ', 'mel de', 'mel silvestre', 'mel puro'], '🍯'],

  // ---------- Snacks ----------
  [['batata chips', 'batata palha', 'chips'], '🥔'],
  [['salgadinho', 'salgadin', 'salg ', 'doritos', 'cheetos', 'fandangos'], '🍟'],
  [['pipoca'], '🍿'],
  [['castanha', 'noz ', 'nozes', 'amendoa', 'avela'], '🌰'],
  [['barra de cereal'], '🥣'],
  [['cereal', 'cer mat', 'granola', 'sucrilhos', 'flocos de milho'], '🥣'],
  [['biscoito', 'bisc ', 'bolacha', 'cookie', 'wafer', 'waffer'], '🍪'],

  // ---------- Bebidas ----------
  [['agua de coco', 'coco'], '🥥'],
  [['agua com gas', 'agua mineral', 'agua '], '💧'],
  [['refrigerante', 'ref ', 'refri', 'coca', 'guarana', 'fanta', 'sprite', 'pepsi', 'soda', 'tonica', 'sukita', 'kuat', 'isoto', 'powerade'], '🥤'],
  [['suco', 'nectar'], '🧃'],
  [['cafe', 'filtro papel', 'filtro de cafe'], '☕'],
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
  [['batata', 'mandioca', 'mandioquinha', 'aipim', 'inhame'], '🥔'],
  [['cenoura'], '🥕'],
  [['beterraba'], '🟣'],
  [['pepino', 'abobrinha', 'chuchu'], '🥒'],
  [['berinjela'], '🍆'],
  [['abobora', 'moranga', 'jerimum'], '🎃'],
  [['pimentao'], '🫑'],
  [['pimenta'], '🌶️'],
  [['cebola'], '🧅'],
  [[' alho '], '🧄'],
  [['milho'], '🌽'],

  // ---------- Básicos ----------
  [['acucar', 'acuc'], '🍬'],
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
