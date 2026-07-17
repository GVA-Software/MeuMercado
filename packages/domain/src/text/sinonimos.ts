import { semAcento } from './busca.js';

/**
 * Sinônimos e apelidos → termo(s) canônico(s) do catálogo. Só entram casos em que
 * a busca por substring NÃO resolve sozinha (palavra diferente): "bolacha"→
 * "biscoito", "xampu"→"shampoo". Marcas que já aparecem no nome (Coca, OMO, Nescau)
 * não precisam de entrada — o `combinaBusca` já casa por substring.
 *
 * É o PONTO DE CRESCIMENTO da Nina: conforme os fallbacks reais aparecem (evento
 * `nina_sem_resposta`), o ADM adiciona linhas aqui — a Nina "aprende" com o uso.
 */
const SINONIMOS: Array<[RegExp, string]> = [
  [/\bbolachas?\b/g, 'biscoito'],
  [/\bpasta (de |dental )?dentes?\b/g, 'creme dental'],
  [/\bpasta de dente\b/g, 'creme dental'],
  [/\bxampus?\b/g, 'shampoo'],
  [/\bmiojo\b/g, 'macarrao'],
  [/\bmaizena\b/g, 'amido milho'],
  [/\bqueijo ralado\b/g, 'parmesao'],
  [/\brefri\b/g, 'refrigerante'],
  [/\bmacarrao instantaneo\b/g, 'macarrao'],
  [/\bpapel hig\b/g, 'papel higienico'],
];

/**
 * Reescreve o termo aplicando os sinônimos conhecidos (sem acento, minúsculo).
 * Devolve o termo canônico pra alimentar a busca; sem correspondência, devolve o
 * próprio termo normalizado.
 */
export function aplicarSinonimos(termo: string): string {
  let t = ` ${semAcento(termo)} `;
  for (const [re, canonico] of SINONIMOS) t = t.replace(re, ` ${canonico} `);
  return t.replace(/\s+/g, ' ').trim();
}
