import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chaveProduto, type Periodo } from '@meumercado/domain';
import {
  PLANOS,
  type AdminDuplicadosDTO,
  type AdminFunnelDTO,
  type AdminStatsDTO,
  type AdminUserDTO,
  type AdminUsersResponse,
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
import {
  PRICE_OBSERVATION_REPOSITORY,
  type PriceObservationRepository,
} from '../pricing/price-observation.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { PushService } from '../push/push.service.js';

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
  ) {}

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

  private async toAdminUser(user: StoredUser): Promise<AdminUserDTO> {
    const dto = this.billing.toDTO(await this.billing.forUser(user.id));
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      criadoEm: user.criadoEm.toISOString(),
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
    const items = await Promise.all(
      all.slice(offset, offset + limit).map((u) => this.toAdminUser(u)),
    );
    return { total: all.length, items };
  }

  async stats(): Promise<AdminStatsDTO> {
    const all = await this.users.findAll();
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
      const dto = this.billing.toDTO(await this.billing.forUser(u.id));
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
    await this.users.delete(targetId);
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
