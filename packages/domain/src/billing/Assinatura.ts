import { InvalidSubscriptionError } from '../errors.js';

export type Plano = 'free' | 'pro';
export type Periodo = 'mensal' | 'anual';
export type StatusAssinatura = 'trial' | 'ativa' | 'cancelada' | 'expirada';

const DAY_MS = 24 * 60 * 60 * 1000;
const DIAS_TRIAL_PADRAO = 7;
const DIAS = { mensal: 30, anual: 365 } as const;

export interface AssinaturaJSON {
  usuarioId: string;
  plano: Plano;
  periodo: Periodo | null;
  status: StatusAssinatura;
  trialFim: string | null;
  periodoFim: string | null;
}

/**
 * Assinatura de um usuário. Imutável — transições (iniciar trial, ativar,
 * cancelar) retornam uma NOVA instância. A regra de "é Pro agora?" mora aqui,
 * então tanto o guard da API quanto a UI usam a MESMA lógica. Determinística:
 * recebe `now`, não lê o relógio.
 */
export class Assinatura {
  readonly usuarioId: string;
  readonly plano: Plano;
  readonly periodo: Periodo | null;
  readonly status: StatusAssinatura;
  readonly trialFim: Date | null;
  readonly periodoFim: Date | null;

  constructor(params: {
    usuarioId: string;
    plano: Plano;
    periodo?: Periodo | null;
    status: StatusAssinatura;
    trialFim?: Date | null;
    periodoFim?: Date | null;
  }) {
    if (!params.usuarioId) {
      throw new InvalidSubscriptionError('Assinatura precisa de usuarioId');
    }
    this.usuarioId = params.usuarioId;
    this.plano = params.plano;
    this.periodo = params.periodo ?? null;
    this.status = params.status;
    this.trialFim = params.trialFim ?? null;
    this.periodoFim = params.periodoFim ?? null;
    Object.freeze(this);
  }

  /** Assinatura gratuita padrão (todo usuário novo começa assim). */
  static free(usuarioId: string): Assinatura {
    return new Assinatura({ usuarioId, plano: 'free', status: 'ativa' });
  }

  /** Inicia um período de teste do Pro. */
  static iniciarTrial(usuarioId: string, agora: Date, dias = DIAS_TRIAL_PADRAO): Assinatura {
    return new Assinatura({
      usuarioId,
      plano: 'pro',
      status: 'trial',
      trialFim: new Date(agora.getTime() + dias * DAY_MS),
    });
  }

  /** Ativa o Pro pago (chamado após confirmação do gateway/webhook). */
  ativar(periodo: Periodo, inicio: Date): Assinatura {
    return new Assinatura({
      usuarioId: this.usuarioId,
      plano: 'pro',
      periodo,
      status: 'ativa',
      periodoFim: new Date(inicio.getTime() + DIAS[periodo] * DAY_MS),
    });
  }

  cancelar(): Assinatura {
    return new Assinatura({
      usuarioId: this.usuarioId,
      plano: this.plano,
      periodo: this.periodo,
      status: 'cancelada',
      trialFim: this.trialFim,
      periodoFim: this.periodoFim,
    });
  }

  /** Marca como expirada (o trial/período chegou ao fim). */
  expirar(): Assinatura {
    return new Assinatura({
      usuarioId: this.usuarioId,
      plano: this.plano,
      periodo: this.periodo,
      status: 'expirada',
      trialFim: this.trialFim,
      periodoFim: this.periodoFim,
    });
  }

  /** É Pro e ainda vigente neste instante? Cobre trial e período pago. */
  isProAtivo(agora: Date): boolean {
    if (this.plano !== 'pro') return false;
    if (this.status === 'trial') {
      return this.trialFim !== null && agora.getTime() < this.trialFim.getTime();
    }
    if (this.status === 'ativa') {
      return this.periodoFim !== null && agora.getTime() < this.periodoFim.getTime();
    }
    return false;
  }

  emTrial(agora: Date): boolean {
    return this.status === 'trial' && this.isProAtivo(agora);
  }

  /** Dias restantes de vigência (trial ou período). 0 se não aplicável. */
  diasRestantes(agora: Date): number {
    const fim = this.status === 'trial' ? this.trialFim : this.periodoFim;
    if (!fim) return 0;
    return Math.max(0, Math.ceil((fim.getTime() - agora.getTime()) / DAY_MS));
  }

  toJSON(): AssinaturaJSON {
    return {
      usuarioId: this.usuarioId,
      plano: this.plano,
      periodo: this.periodo,
      status: this.status,
      trialFim: this.trialFim?.toISOString() ?? null,
      periodoFim: this.periodoFim?.toISOString() ?? null,
    };
  }
}
