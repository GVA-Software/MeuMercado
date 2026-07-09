/**
 * Emoji automático para um produto a partir do nome (razão da NFC-e vem em
 * abreviações/caixa alta, ex.: "PRES.MAG.COZ.SEARA"). Heurística leve e 100%
 * local — sem custo de API. Usada como fallback quando o produto não tem emoji
 * próprio no catálogo. A ordem importa: regras mais específicas vêm primeiro.
 */

function normaliza(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.\-_/]/g, ' ');
}

/** [palavras-chave, emoji] — a primeira que casar (substring) vence. */
const REGRAS: Array<[readonly string[], string]> = [
  // Limpeza / higiene / casa
  [['saco lixo', 'saco de lixo', 'embalixo', ' lixo'], '🗑️'],
  [['papel higien', 'papel toalha', 'guardanapo'], '🧻'],
  [['sabao', 'detergente', 'amaciante', 'lava roupa', 'limpeza', 'desinfet', 'agua sanit', 'multiuso'], '🧼'],
  [['shampoo', 'condicionador', 'sabonete', 'desodorante', 'hidratante'], '🧴'],
  [['pasta dente', 'creme dental', 'escova dente'], '🪥'],
  [['fralda'], '👶'],
  [['pilha', 'bateria'], '🔋'],
  // Frios / carnes / proteínas
  [['mussarela', 'mucarela', 'muzarela', 'queijo', 'requeijao', 'parmesao'], '🧀'],
  [['presunt', 'apresunt', 'pres mag', 'mortadela', 'salame', 'peito peru', 'blanquet'], '🍖'],
  [['bacon', 'linguica', 'salsich', 'toucinho'], '🥓'],
  [['frango', 'coxa', 'sobrecoxa', 'peito de frango', 'file de frango'], '🍗'],
  [['carne', 'bife', 'patinho', 'acem', 'coxao', 'alcatra', 'costela', 'picanha', 'moida', 'musculo'], '🥩'],
  [['peixe', 'sardinha', 'atum', 'tilapia', 'merluza', 'bacalhau', 'salmao'], '🐟'],
  [['ovos', 'ovo '], '🥚'],
  [['presunto'], '🍖'],
  // Laticínios / básicos
  [['leite', 'iogurte', 'nescau', 'achocolatado'], '🥛'],
  [['manteiga', 'margarina'], '🧈'],
  [['arroz'], '🍚'],
  [['feijao', 'lentilha', 'grao de bico'], '🫘'],
  [['macarrao', 'espaguete', 'espaguet', 'miojo', 'lamen', 'massa', 'talharim', 'penne'], '🍝'],
  [['farinha', 'trigo', 'fuba', 'polvilho', 'amido'], '🌾'],
  [['acucar'], '🍬'],
  [['sal '], '🧂'],
  [['cafe'], '☕'],
  [['oleo', 'banha'], '🛢️'],
  [['azeite', 'azeitona'], '🫒'],
  [['vinagre', 'molho', 'ketchup', 'maionese', 'mostarda', 'shoyu', 'extrato', 'tempero', 'caldo'], '🥫'],
  [['pao', 'baguete', 'bisnaga', 'torrada'], '🍞'],
  [['bolacha', 'biscoito', 'cookie', 'wafer', 'rosquinha'], '🍪'],
  [['chocolate', 'bombom', 'brigadeiro', 'nutella'], '🍫'],
  [['bolo', 'panetone', 'torta'], '🍰'],
  [['sorvete', 'picole'], '🍨'],
  [['pipoca'], '🍿'],
  [['amendoim', 'castanha', 'noz', 'amendoa'], '🥜'],
  [['cereal', 'aveia', 'granola', 'sucrilhos'], '🥣'],
  [['pizza'], '🍕'],
  [['caldeirao', 'panela', 'frigideira', 'caldeirão'], '🍲'],
  // Hortifrúti
  [['tomate'], '🍅'],
  [['batata'], '🥔'],
  [['cebola'], '🧅'],
  [['alho'], '🧄'],
  [['cenoura'], '🥕'],
  [['alface', 'couve', 'rucula', 'verdura', 'salada', 'espinafre'], '🥬'],
  [['milho'], '🌽'],
  [['banana'], '🍌'],
  [['maca', 'maça'], '🍎'],
  [['laranja', 'mexerica', 'tangerina'], '🍊'],
  [['limao'], '🍋'],
  [['uva'], '🍇'],
  [['melancia'], '🍉'],
  [['abacaxi'], '🍍'],
  [['manga'], '🥭'],
  [['morango'], '🍓'],
  [['abacate'], '🥑'],
  // "mel" fica após "melancia" para não capturar a fruta por substring.
  [['mel de', 'mel silvestre', 'mel puro', ' mel'], '🍯'],
  // Bebidas
  [['refrigerante', 'coca', 'guarana', 'fanta', 'sprite', 'pepsi', 'soda'], '🥤'],
  [['suco', 'nectar'], '🧃'],
  [['agua'], '💧'],
  [['cerveja', 'chopp'], '🍺'],
  [['vinho', 'espumante'], '🍷'],
  [['cachaca', 'vodka', 'whisky', 'gin', 'licor'], '🍸'],
];

export function emojiParaProduto(nome: string): string {
  const n = normaliza(nome);
  for (const [chaves, emoji] of REGRAS) {
    for (const c of chaves) if (n.includes(c)) return emoji;
  }
  return '📦';
}

/** Emoji do produto: o próprio (catálogo) ou um inferido pelo nome. */
export function emojiDe(p: { emoji?: string | null | undefined; nome: string }): string {
  return p.emoji || emojiParaProduto(p.nome);
}
