import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  chaveProduto,
  Produto,
  semAcento,
  sugerirCategoria,
  type Assinatura,
  type Categoria,
  type Periodo,
} from '@meumercado/domain';
import {
  PLANOS,
  type AdminCoberturaDTO,
  type AdminDuplicadosDTO,
  type AdminFunnelDTO,
  type AdminProdutoEdicaoDTO,
  type AdminStatsDTO,
  type AdminUserDTO,
  type AdminUsersResponse,
  type NinaTreinoResponse,
  type QaConversaReportDTO,
} from '@meumercado/contracts';
import { isAdminEmail } from '../../common/admin-emails.js';
import { auditarConversa } from '../../qa/conversation-qa.js';
import { PRODUTO_REPOSITORY, type ProdutoRepository } from '../catalog/produtos.repository.js';
import type { Env } from '../../config/env.schema.js';
import type { AuthedUser } from '../auth/jwt-auth.guard.js';
import { USER_REPOSITORY, type StoredUser, type UserRepository } from '../auth/user.repository.js';
import {
  ANALYTICS_REPOSITORY,
  type AnalyticsRepository,
} from '../analytics/analytics.repository.js';
import { SINONIMO_REPOSITORY, type SinonimoRepository } from '../insights/sinonimo.repository.js';
import { RECEITA_REPOSITORY, type ReceitaRepository } from '../insights/receita.repository.js';
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from '../pricing/price-observation.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { PushService } from '../push/push.service.js';
import { EMAIL_SERVICE, type EmailService } from '../email/email.service.js';

const DIA_MS = 24 * 60 * 60 * 1000;

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly billing: BillingService,
    private readonly push: PushService,
    private readonly config: ConfigService<Env, true>,
    @Inject(ANALYTICS_REPOSITORY) private readonly analytics: AnalyticsRepository,
    @Inject(PRICE_OBSERVATION_REPOSITORY) private readonly prices: PriceObservationRepository,
    @Inject(PRODUTO_REPOSITORY) private readonly produtos: ProdutoRepository,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
    @Inject(SINONIMO_REPOSITORY) private readonly sinonimos: SinonimoRepository,
    @Inject(RECEITA_REPOSITORY) private readonly receitas: ReceitaRepository,
  ) {}

  /**
   * Painel de TREINO da Nina: as perguntas que ela não respondeu (agregadas do
   * evento `nina_sem_resposta`) + os sinônimos já ensinados. O ADM olha as
   * perguntas frequentes e ensina um sinônimo com 1 clique (a Nina passa a
   * entender na hora). É o loop de aprendizado, human-in-the-loop.
   */
  async ninaTreino(): Promise<NinaTreinoResponse> {
    const eventos = await this.analytics.listarPorNome('nina_sem_resposta');
    const agg = new Map<string, { vezes: number; usuarios: Set<string>; ultimo: Date | null }>();
    for (const e of eventos) {
      const q = String(e.props?.q ?? '').trim();
      if (!q) continue;
      const chave = q.toLowerCase();
      const cur = agg.get(chave) ?? { vezes: 0, usuarios: new Set<string>(), ultimo: null };
      cur.vezes += 1;
      if (e.userId) cur.usuarios.add(e.userId);
      if (!cur.ultimo || e.createdAt > cur.ultimo) cur.ultimo = e.createdAt;
      agg.set(chave, cur);
    }
    const semResposta = [...agg.entries()]
      .map(([pergunta, v]) => ({
        pergunta,
        vezes: v.vezes,
        usuarios: v.usuarios.size,
        ultimoEm: v.ultimo ? v.ultimo.toISOString() : null,
      }))
      .sort((a, b) => b.vezes - a.vezes)
      .slice(0, 50);
    const sinonimos = (await this.sinonimos.listar()).map((s) => ({
      alias: s.alias,
      canonico: s.canonico,
      criadoEm: s.criadoEm.toISOString(),
    }));
    const receitas = (await this.receitas.listar()).map((r) => ({
      nome: r.nome,
      gatilhos: r.gatilhos,
      itens: r.itens,
      criadoEm: r.criadoEm.toISOString(),
    }));
    return { semResposta, sinonimos, receitas };
  }

  /** Ensina uma receita/evento: gatilhos → itens da lista. A Nina usa na hora. */
  async ensinarReceita(nome: string, gatilhos: string[], itens: string[]): Promise<void> {
    const limpos = gatilhos.map((g) => g.trim()).filter(Boolean);
    const its = itens.map((i) => i.trim()).filter(Boolean);
    if (!limpos.length || !its.length) throw new BadRequestException('Gatilhos e itens obrigatórios.');
    await this.receitas.salvar({ nome: nome.trim(), gatilhos: limpos, itens: its, criadoEm: new Date() });
  }

  /** Remove uma receita ensinada. */
  async esquecerReceita(nome: string): Promise<void> {
    await this.receitas.remover(nome.trim());
  }

  /** Ensina um sinônimo (o alias é normalizado). A Nina usa na próxima busca. */
  async ensinarSinonimo(alias: string, canonico: string): Promise<void> {
    const a = semAcento(alias);
    if (a.length < 2) throw new BadRequestException('Apelido inválido.');
    await this.sinonimos.salvar({ alias: a, canonico: canonico.trim(), criadoEm: new Date() });
  }

  /** Remove um sinônimo ensinado. */
  async esquecerSinonimo(alias: string): Promise<void> {
    await this.sinonimos.remover(semAcento(alias));
  }

  /**
   * Envia um e-mail de teste para o próprio ADM, validando a config de SMTP na
   * hora (o envio normal é best-effort silencioso). Diz se está desligado ou se
   * a config está errada — sem isso, ligar o e-mail é "no escuro".
   */
  async testarEmail(para: string): Promise<{ mensagem: string }> {
    if (!this.email.estaLigado()) {
      throw new BadRequestException(
        'E-mail desligado. Configure SMTP_HOST, SMTP_USER e SMTP_PASS no Render.',
      );
    }
    try {
      await this.email.enviarTeste(para);
    } catch (e) {
      throw new BadGatewayException(`Não consegui enviar: ${String(e)}`);
    }
    return {
      mensagem: `E-mail de teste enviado para ${para}. Confira a caixa de entrada (e o spam).`,
    };
  }

  /**
   * QA de conversação da Nina sobre o catálogo VIVO — cobre todos os produtos,
   * inclusive os que entrarem. Roda a lógica real (busca + ranking) por 5 lentes.
   */
  async qaConversa(): Promise<QaConversaReportDTO> {
    const [catalogo, observacoes] = await Promise.all([this.produtos.findAll(), this.prices.all()]);
    const report = auditarConversa(
      catalogo.map((p) => ({ id: p.id, nome: p.nome })),
      observacoes,
    );
    return { ...report, geradoEm: new Date().toISOString() };
  }

  /**
   * Varredura de duplicados: agrupa o catálogo pela chave normalizada (conjunto de
   * palavras) e devolve os grupos com 2+ produtos — o mesmo item com nomes
   * diferentes do cupom. Cada produto vem com nº de preços e mercados.
   */
  async duplicados(): Promise<AdminDuplicadosDTO> {
    const [catalogo, observacoes] = await Promise.all([this.produtos.findAll(), this.prices.all()]);
    const stats = new Map<string, { precos: number; mercados: Set<string> }>();
    for (const o of observacoes) {
      if (o.reporterId === 'seed') continue;
      const e = stats.get(o.produtoId) ?? { precos: 0, mercados: new Set<string>() };
      e.precos += 1;
      e.mercados.add(o.mercadoId);
      stats.set(o.produtoId, e);
    }
    const grupos = new Map<string, Array<{ id: string; nome: string }>>();
    for (const p of catalogo) {
      const k = chaveProduto(p.nome);
      if (!k) continue;
      const arr = grupos.get(k) ?? [];
      arr.push({ id: p.id, nome: p.nome });
      grupos.set(k, arr);
    }
    return {
      grupos: [...grupos.entries()]
        .filter(([, ps]) => ps.length > 1)
        .map(([chave, ps]) => ({
          chave,
          produtos: ps.map((p) => ({
            id: p.id,
            nome: p.nome,
            precos: stats.get(p.id)?.precos ?? 0,
            mercados: stats.get(p.id)?.mercados.size ?? 0,
          })),
        })),
    };
  }

  /** Junta um grupo: move os preços de cada `removerIds` pro `manterId` e remove. */
  async juntarDuplicados(manterId: string, removerIds: string[]): Promise<void> {
    // Sem isto, um `manterId` inexistente (ex.: já removido em outra aba) faria os
    // preços serem movidos para um produto órfão — sumiriam da tabela.
    if (!(await this.produtos.findById(manterId))) {
      throw new BadRequestException('Produto de destino não existe mais — recarregue a lista.');
    }
    for (const from of removerIds) {
      if (from === manterId) continue;
      await this.prices.reassignProduto(from, manterId);
      await this.produtos.delete(from);
    }
  }

  /**
   * Painel de COBERTURA: o que temos cadastrado (produtos × mercados) e quem mais
   * contribui. Serve pra enxergar onde a base está rasa (produtos com preço em só 1
   * mercado não dão comparação) e guiar o esforço de cobertura. Base pequena →
   * agrega em memória a partir das observações.
   */
  async cobertura(): Promise<AdminCoberturaDTO> {
    const [catalogo, observacoes, usuarios] = await Promise.all([
      this.produtos.findAll(),
      this.prices.all(),
      this.users.findAll(),
    ]);
    const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));

    const porProduto = new Map<string, { mercados: Set<string>; precos: number; ultimo: number }>();
    const porMercado = new Map<
      string,
      {
        nome: string;
        endereco: string | null;
        produtos: Set<string>;
        precos: number;
        ultimo: number;
      }
    >();
    const porReporter = new Map<string, number>();

    for (const o of observacoes) {
      const p = porProduto.get(o.produtoId) ?? { mercados: new Set(), precos: 0, ultimo: 0 };
      p.mercados.add(o.mercadoId);
      p.precos += 1;
      p.ultimo = Math.max(p.ultimo, o.observedAt.getTime());
      porProduto.set(o.produtoId, p);

      const m = porMercado.get(o.mercadoId) ?? {
        nome: o.mercadoNome ?? o.mercadoId,
        endereco: null,
        produtos: new Set(),
        precos: 0,
        ultimo: 0,
      };
      if (o.mercadoNome) m.nome = o.mercadoNome;
      if (o.mercadoEndereco) m.endereco = o.mercadoEndereco;
      m.produtos.add(o.produtoId);
      m.precos += 1;
      m.ultimo = Math.max(m.ultimo, o.observedAt.getTime());
      porMercado.set(o.mercadoId, m);

      // Contribuidores: exclui a base de seed (não é usuário real).
      if (o.reporterId !== 'seed') {
        porReporter.set(o.reporterId, (porReporter.get(o.reporterId) ?? 0) + 1);
      }
    }

    const iso = (ms: number): string | null => (ms ? new Date(ms).toISOString() : null);

    const produtos = catalogo
      .map((p) => {
        const agg = porProduto.get(p.id);
        const mercadosNomes = agg
          ? [...agg.mercados]
              .map((id) => porMercado.get(id)?.nome ?? id)
              .sort((a, b) => a.localeCompare(b))
          : [];
        return {
          id: p.id,
          nome: p.nome,
          categoria: p.categoria,
          mercados: agg?.mercados.size ?? 0,
          mercadosNomes,
          precos: agg?.precos ?? 0,
          ultimoEm: iso(agg?.ultimo ?? 0),
        };
      })
      // Cobertura mais RASA primeiro: guia o que ainda precisa de mais mercados.
      .sort(
        (a, b) => a.mercados - b.mercados || b.precos - a.precos || a.nome.localeCompare(b.nome),
      );

    const mercados = [...porMercado.entries()]
      .map(([id, m]) => ({
        id,
        nome: m.nome,
        endereco: m.endereco,
        produtos: m.produtos.size,
        precos: m.precos,
        ultimoEm: iso(m.ultimo),
      }))
      .sort((a, b) => b.produtos - a.produtos || b.precos - a.precos);

    const topUsuarios = [...porReporter.entries()]
      .map(([userId, cadastros]) => {
        const u = usuarioPorId.get(userId);
        return {
          userId,
          nome: u?.nome ?? '(usuário removido)',
          email: u?.email ?? '—',
          cadastros,
        };
      })
      .sort((a, b) => b.cadastros - a.cadastros);

    return {
      totais: {
        produtosCatalogo: catalogo.length,
        produtosComPreco: produtos.filter((p) => p.precos > 0).length,
        produtosMultiMercado: produtos.filter((p) => p.mercados >= 2).length,
        mercados: porMercado.size,
        precos: observacoes.length,
        contribuidores: porReporter.size,
      },
      produtos,
      mercados,
      topUsuarios,
    };
  }

  /**
   * Exclui produtos em lote: apaga os preços do produto E o produto do catálogo —
   * some da comparação nos apps dos usuários. Ignora ids que já não existem.
   */
  async excluirProdutos(ids: string[]): Promise<{ excluidos: number }> {
    let excluidos = 0;
    for (const id of ids) {
      if (!(await this.produtos.findById(id))) continue;
      await this.prices.deleteByProduto(id);
      await this.produtos.delete(id);
      excluidos += 1;
    }
    return { excluidos };
  }

  /**
   * Junta mercados: os preços dos `removerIds` passam a apontar pro `manterId`,
   * adotando o nome do destino. O endereço é PRESERVADO — usa o do destino ou, se
   * ele não tiver, o primeiro endereço não-vazio do grupo (não perde o dado bom).
   */
  async juntarMercados(manterId: string, removerIds: string[]): Promise<{ mercados: number }> {
    const observacoes = await this.prices.all();
    const infos = new Map<string, { nome: string; endereco: string | null }>();
    for (const o of observacoes) {
      const atual = infos.get(o.mercadoId);
      if (!atual) {
        infos.set(o.mercadoId, {
          nome: o.mercadoNome ?? o.mercadoId,
          endereco: o.mercadoEndereco ?? null,
        });
      } else if (o.mercadoEndereco && !atual.endereco) {
        atual.endereco = o.mercadoEndereco;
      }
    }
    const alvo = infos.get(manterId);
    if (!alvo) {
      throw new BadRequestException('Mercado de destino não existe mais — recarregue a lista.');
    }
    let endereco = alvo.endereco;
    if (!endereco) {
      for (const id of removerIds) {
        const e = infos.get(id)?.endereco;
        if (e) {
          endereco = e;
          break;
        }
      }
    }
    let mercados = 0;
    for (const from of removerIds) {
      if (from === manterId || !infos.has(from)) continue;
      await this.prices.reassignMercado(from, manterId, alvo.nome, endereco);
      mercados += 1;
    }
    return { mercados };
  }

  /**
   * Edita nome/endereço de um mercado (todas as suas observações). Limpa a coordenada
   * pra o mapa re-geocodificar o novo endereço.
   */
  async editarMercado(mercadoId: string, nome: string, endereco: string | null): Promise<void> {
    const existe = (await this.prices.all()).some((o) => o.mercadoId === mercadoId);
    if (!existe) {
      throw new BadRequestException('Mercado não existe mais — recarregue a lista.');
    }
    await this.prices.atualizarMercado(mercadoId, nome.trim(), endereco?.trim() || null);
  }

  /**
   * Exclui mercados: apaga TODOS os preços dos mercados (some da comparação nos apps).
   * Os produtos ficam no catálogo — só perdem a cobertura daquele mercado.
   */
  async excluirMercados(ids: string[]): Promise<{ mercados: number; precos: number }> {
    const observacoes = await this.prices.all();
    const existentes = new Set(observacoes.map((o) => o.mercadoId));
    const alvos = new Set(ids);
    const precos = observacoes.filter((o) => alvos.has(o.mercadoId)).length;
    let mercados = 0;
    for (const id of ids) {
      if (!existentes.has(id)) continue;
      await this.prices.deleteByMercado(id);
      mercados += 1;
    }
    return { mercados, precos };
  }

  /** Dados de um produto + seus reportes de preço (para o editor do ADM). */
  async produtoEdicao(id: string): Promise<AdminProdutoEdicaoDTO> {
    const p = await this.produtos.findById(id);
    if (!p) throw new NotFoundException('Produto não encontrado.');
    const obs = await this.prices.findByProduto(id);
    const precos = obs
      .map((o) => ({
        id: o.id,
        mercadoNome: o.mercadoNome ?? o.mercadoId,
        endereco: o.mercadoEndereco ?? null,
        precoCents: o.price.cents,
        observedAt: o.observedAt.toISOString(),
        source: o.source,
      }))
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
    return { id: p.id, nome: p.nome, categoria: p.categoria, unidade: p.unidade, precos };
  }

  /** Edita nome/categoria de um produto (ex.: corrigir gramatura pós-merge). */
  async editarProduto(id: string, nome: string, categoria: Categoria): Promise<void> {
    if (!(await this.produtos.findById(id))) {
      throw new NotFoundException('Produto não encontrado.');
    }
    const ok = await this.produtos.atualizar(id, { nome: nome.trim(), categoria });
    if (!ok) {
      throw new BadRequestException('Não foi possível editar o produto (pode ter sido removido).');
    }
  }

  /**
   * Auto-classifica os produtos que estão em "Outros" pela heurística de nome
   * (só mexe nos "Outros"; não sobrescreve o que já foi classificado à mão).
   */
  async autoClassificar(): Promise<{
    classificados: number;
    porCategoria: Record<string, number>;
  }> {
    const produtos = await this.produtos.findAll();
    const porCategoria: Record<string, number> = {};
    let classificados = 0;
    for (const p of produtos) {
      if (p.categoria !== 'Outros') continue;
      const sug = sugerirCategoria(p.nome);
      if (sug === 'Outros') continue;
      if (await this.produtos.atualizar(p.id, { nome: p.nome, categoria: sug })) {
        classificados += 1;
        porCategoria[sug] = (porCategoria[sug] ?? 0) + 1;
      }
    }
    return { classificados, porCategoria };
  }

  /** Define a categoria de vários produtos de uma vez (classificação em lote). */
  async classificarProdutos(
    ids: string[],
    categoria: Categoria,
  ): Promise<{ classificados: number }> {
    let classificados = 0;
    for (const id of ids) {
      const p = await this.produtos.findById(id);
      if (!p) continue;
      if (await this.produtos.atualizar(id, { nome: p.nome, categoria })) classificados += 1;
    }
    return { classificados };
  }

  /** Corrige o valor de UM reporte de preço. */
  async editarPreco(id: string, precoCents: number): Promise<void> {
    const existe = (await this.prices.all()).some((o) => o.id === id);
    if (!existe) throw new NotFoundException('Reporte de preço não encontrado.');
    await this.prices.updatePreco(id, precoCents);
  }

  /** Exclui UM reporte de preço (report errado). */
  async excluirPreco(id: string): Promise<void> {
    await this.prices.deleteById(id);
  }

  /**
   * Separa UM reporte num produto NOVO: cria o produto (nome informado, herdando
   * categoria/unidade do original) e move a observação pra ele. Usado quando
   * gramaturas diferentes ficaram juntas no mesmo produto.
   */
  async separarPreco(obsId: string, nome: string): Promise<void> {
    const obs = (await this.prices.all()).find((o) => o.id === obsId);
    if (!obs) throw new NotFoundException('Reporte de preço não encontrado.');
    const original = await this.produtos.findById(obs.produtoId);
    const novo = new Produto({
      id: randomUUID(),
      nome: nome.trim(),
      categoria: original?.categoria ?? 'Outros',
      unidade: original?.unidade ?? 'un',
    });
    await this.produtos.add(novo);
    await this.prices.moverObservacao(obsId, novo.id);
  }

  /**
   * Funil de ativação: do cadastro ao 1º preço. A base já está ativa — "registrou
   * preço" é derivado de `reporter_id` (sem seed); só o topo (onboarding) é evento.
   */
  async funil(): Promise<AdminFunnelDTO> {
    const usuarios = await this.users.findAll();
    const eventos = await this.analytics.resumo();
    const distintos = (name: string): number => eventos.find((e) => e.name === name)?.usuarios ?? 0;

    const observacoes = await this.prices.all();
    const reporters = new Set(
      observacoes.filter((o) => o.reporterId !== 'seed').map((o) => o.reporterId),
    );
    const vistos = new Set(await this.analytics.usuariosComEvento('onboarding_visto'));
    let vistosQueRegistraram = 0;
    for (const r of reporters) if (vistos.has(r)) vistosQueRegistraram += 1;

    return {
      totalUsuarios: usuarios.length,
      onboardingVistos: distintos('onboarding_visto'),
      clicaramRegistrar: distintos('onboarding_cta_registrar'),
      explorar: distintos('onboarding_explorar'),
      dispensaram: distintos('onboarding_dispensado'),
      registraramPreco: reporters.size,
      vistosQueRegistraram,
      eventos,
    };
  }

  private get adminCsv(): string {
    return this.config.get('ADMIN_EMAILS', { infer: true });
  }

  private async toAdminUser(user: StoredUser, assinatura?: Assinatura): Promise<AdminUserDTO> {
    const dto = this.billing.toDTO(assinatura ?? (await this.billing.forUser(user.id)));
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      criadoEm: user.criadoEm.toISOString(),
      excluidoEm: user.excluidoEm ? user.excluidoEm.toISOString() : null,
      politicaVersao: user.politicaVersao ?? null,
      isAdmin: isAdminEmail(user.email, this.adminCsv),
      plano: dto.plano,
      periodo: dto.periodo,
      status: dto.status,
      isPro: dto.isPro,
      diasRestantes: dto.diasRestantes,
      trialFim: dto.trialFim,
      periodoFim: dto.periodoFim,
    };
  }

  async listar(limit: number, offset: number): Promise<AdminUsersResponse> {
    const all = await this.users.findAll();
    const pagina = all.slice(offset, offset + limit);
    // Uma leitura de assinaturas para a página toda (antes: 1 query por usuário).
    const subs = await this.billing.mapaResolvido(pagina.map((u) => u.id));
    const items = await Promise.all(pagina.map((u) => this.toAdminUser(u, subs.get(u.id))));
    return { total: all.length, items };
  }

  async stats(): Promise<AdminStatsDTO> {
    const all = await this.users.findAll();
    // Uma leitura de assinaturas para todos (antes: 1 query por usuário → N+1).
    const subs = await this.billing.mapaResolvido(all.map((u) => u.id));
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const agora = Date.now();
    let admins = 0;
    let proAtivos = 0;
    let trials = 0;
    let free = 0;
    let cadastrosHoje = 0;
    let cadastros7d = 0;
    let cadastros30d = 0;
    for (const u of all) {
      if (isAdminEmail(u.email, this.adminCsv)) admins += 1;
      const dto = this.billing.toDTO(subs.get(u.id)!);
      if (!dto.isPro) free += 1;
      else if (dto.status === 'trial') trials += 1;
      else proAtivos += 1;
      const t = u.criadoEm.getTime();
      if (t >= inicioHoje.getTime()) cadastrosHoje += 1;
      if (agora - t <= 7 * DIA_MS) cadastros7d += 1;
      if (agora - t <= 30 * DIA_MS) cadastros30d += 1;
    }
    return {
      totalUsuarios: all.length,
      admins,
      proAtivos,
      trials,
      free,
      cadastrosHoje,
      cadastros7d,
      cadastros30d,
    };
  }

  async excluir(targetId: string, acting: AuthedUser): Promise<void> {
    if (targetId === acting.id) {
      throw new BadRequestException('Você não pode excluir a si mesmo.');
    }
    const target = await this.users.findById(targetId);
    if (!target) throw new NotFoundException('Usuário não encontrado.');
    if (isAdminEmail(target.email, this.adminCsv)) {
      throw new ForbiddenException('Não é possível excluir outro administrador.');
    }
    // Soft-delete: mantém a linha (aparece como "excluído" no painel) e PRESERVA os
    // preços que o usuário cadastrou — a base é comunitária.
    if (!target.excluidoEm) await this.users.marcarExcluido(targetId, new Date());
  }

  async concederTrial(targetId: string): Promise<AdminUserDTO> {
    const user = await this.exigirUsuario(targetId);
    // Não rebaixar: se já é Pro ativo (pago ou trial), conceder trial encurtaria/
    // sobrescreveria o plano atual.
    if ((await this.billing.forUser(targetId)).isProAtivo(new Date())) {
      throw new BadRequestException(
        'Este usuário já tem Pro ativo — não há por que conceder trial.',
      );
    }
    const dto = this.billing.toDTO(await this.billing.iniciarTrial(targetId));
    await this.push.enviarPara(targetId, {
      title: '🎁 Teste da Nina IA liberado!',
      body: `${primeiroNome(user.nome)}, você ganhou ${dto.diasRestantes} dias grátis de Nina IA. Aproveite!`,
      url: '/',
    });
    return this.toAdminUser(user);
  }

  async concederPro(targetId: string, periodo: Periodo): Promise<AdminUserDTO> {
    const user = await this.exigirUsuario(targetId);
    const dto = this.billing.toDTO(await this.billing.assinar(targetId, periodo));
    await this.push.enviarPara(targetId, {
      title: '🎉 Você agora é Pro!',
      body: `${primeiroNome(user.nome)}, seu plano ${periodo} foi liberado — ${dto.diasRestantes} dias de Nina IA e tudo desbloqueado. Bom proveito!`,
      url: '/',
    });
    return this.toAdminUser(user);
  }

  async revogar(targetId: string): Promise<AdminUserDTO> {
    const user = await this.exigirUsuario(targetId);
    const eraPro = (await this.billing.forUser(targetId)).isProAtivo(new Date());
    await this.billing.cancelar(targetId);
    if (eraPro) {
      await this.push.enviarPara(targetId, {
        title: 'Seu plano Pro foi encerrado',
        body: `${primeiroNome(user.nome)}, a Nina IA foi bloqueada. Você pode renovar por apenas ${PLANOS.mensal.label}.`,
        url: '/',
      });
    }
    return this.toAdminUser(user);
  }

  private async exigirUsuario(id: string): Promise<StoredUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }
}
