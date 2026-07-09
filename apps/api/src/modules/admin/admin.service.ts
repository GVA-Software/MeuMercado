import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Periodo } from '@meumercado/domain';
import type { AdminStatsDTO, AdminUserDTO, AdminUsersResponse } from '@meumercado/contracts';
import { isAdminEmail } from '../../common/admin-emails.js';
import type { Env } from '../../config/env.schema.js';
import type { AuthedUser } from '../auth/jwt-auth.guard.js';
import { USER_REPOSITORY, type StoredUser, type UserRepository } from '../auth/user.repository.js';
import { BillingService } from '../billing/billing.service.js';

const DIA_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly billing: BillingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

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
      status: dto.status,
      isPro: dto.isPro,
      diasRestantes: dto.diasRestantes,
      trialFim: dto.trialFim,
      periodoFim: dto.periodoFim,
    };
  }

  async listar(limit: number, offset: number): Promise<AdminUsersResponse> {
    const all = await this.users.findAll();
    const items = await Promise.all(all.slice(offset, offset + limit).map((u) => this.toAdminUser(u)));
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
    await this.billing.iniciarTrial(targetId);
    return this.toAdminUser(user);
  }

  async concederPro(targetId: string, periodo: Periodo): Promise<AdminUserDTO> {
    const user = await this.exigirUsuario(targetId);
    await this.billing.assinar(targetId, periodo);
    return this.toAdminUser(user);
  }

  async revogar(targetId: string): Promise<AdminUserDTO> {
    const user = await this.exigirUsuario(targetId);
    await this.billing.cancelar(targetId);
    return this.toAdminUser(user);
  }

  private async exigirUsuario(id: string): Promise<StoredUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }
}
