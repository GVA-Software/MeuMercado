import { Injectable } from '@nestjs/common';

export interface StoredUser {
  id: string;
  email: string;
  nome: string;
  /** null = conta só-Google (sem senha). Login por senha não se aplica. */
  passwordHash: string | null;
  criadoEm: Date;
  /** Soft-delete: conta excluída (bloqueia login), mas os preços dela ficam na base. */
  excluidoEm?: Date | null;
  /** Versão da Política/Termos aceita (trilha de consentimento LGPD). */
  politicaVersao?: string | null;
  /** Quando o usuário aceitou a versão atual (cadastro ou reaceite). */
  politicaAceitaEm?: Date | null;
  /** Identidade Google (claim `sub`, estável por usuário) quando a conta usa Google. */
  googleSub?: string | null;
}

/** Porta de acesso a usuários. Assíncrona (suporta memória e banco). */
export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: string): Promise<StoredUser | null>;
  /** Busca pela identidade Google (claim `sub`) — chave estável do login social. */
  findByGoogleSub(sub: string): Promise<StoredUser | null>;
  create(user: StoredUser): Promise<void>;
  /** Vincula uma identidade Google a uma conta já existente (mesmo e-mail verificado). */
  vincularGoogle(id: string, googleSub: string): Promise<void>;
  /** Atualiza só o nome (edição de perfil). */
  updateNome(id: string, nome: string): Promise<void>;
  /** Troca o hash de senha (usado na recuperação de senha). */
  updateSenha(id: string, passwordHash: string): Promise<void>;
  /** Invalida a senha local (vira conta só-Google) — usado ao vincular Google com segurança. */
  invalidarSenha(id: string): Promise<void>;
  /** Todos os usuários (mais recentes primeiro) — uso administrativo. */
  findAll(): Promise<StoredUser[]>;
  count(): Promise<number>;
  delete(id: string): Promise<void>;
  /**
   * Exclusão LGPD: marca como excluída, ANONIMIZA os dados pessoais (nome/e-mail viram
   * placeholder — libera o e-mail original pra novo cadastro) e mantém a linha + os
   * preços que a pessoa cadastrou (base comunitária, já sem PII vinculada).
   */
  marcarExcluido(id: string, quando: Date): Promise<void>;
  /** Registra o (re)aceite da Política/Termos: grava a versão aceita e a data. */
  registrarAceitePolitica(id: string, versao: string, quando: Date): Promise<void>;
}

export const USER_REPOSITORY = 'USER_REPOSITORY';

/** Anonimização LGPD: nome/e-mail placeholder de conta excluída (sem PII). */
export const NOME_EXCLUIDO = 'Usuário excluído';
/** E-mail placeholder único (usa o id, não-reversível) — libera o e-mail original. */
export function emailAnonimo(id: string): string {
  return `excluido+${id}@removido.invalid`;
}

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, StoredUser>();
  private readonly byEmail = new Map<string, StoredUser>();
  private readonly byGoogleSub = new Map<string, StoredUser>();

  findByEmail(email: string): Promise<StoredUser | null> {
    return Promise.resolve(this.byEmail.get(email) ?? null);
  }
  findById(id: string): Promise<StoredUser | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }
  findByGoogleSub(sub: string): Promise<StoredUser | null> {
    return Promise.resolve(this.byGoogleSub.get(sub) ?? null);
  }
  create(user: StoredUser): Promise<void> {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user);
    if (user.googleSub) this.byGoogleSub.set(user.googleSub, user);
    return Promise.resolve();
  }
  vincularGoogle(id: string, googleSub: string): Promise<void> {
    const u = this.byId.get(id);
    if (u) {
      u.googleSub = googleSub;
      this.byGoogleSub.set(googleSub, u);
      this.byEmail.set(u.email, u);
    }
    return Promise.resolve();
  }
  updateNome(id: string, nome: string): Promise<void> {
    const u = this.byId.get(id);
    if (u) {
      u.nome = nome;
      this.byEmail.set(u.email, u);
    }
    return Promise.resolve();
  }
  updateSenha(id: string, passwordHash: string): Promise<void> {
    const u = this.byId.get(id);
    if (u) {
      u.passwordHash = passwordHash;
      this.byEmail.set(u.email, u);
    }
    return Promise.resolve();
  }
  invalidarSenha(id: string): Promise<void> {
    const u = this.byId.get(id);
    if (u) {
      u.passwordHash = null;
      this.byEmail.set(u.email, u);
    }
    return Promise.resolve();
  }
  findAll(): Promise<StoredUser[]> {
    return Promise.resolve(
      [...this.byId.values()].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime()),
    );
  }
  count(): Promise<number> {
    return Promise.resolve(this.byId.size);
  }
  delete(id: string): Promise<void> {
    const u = this.byId.get(id);
    if (u) {
      this.byId.delete(id);
      this.byEmail.delete(u.email);
      if (u.googleSub) this.byGoogleSub.delete(u.googleSub);
    }
    return Promise.resolve();
  }
  marcarExcluido(id: string, quando: Date): Promise<void> {
    const u = this.byId.get(id);
    if (u) {
      this.byEmail.delete(u.email); // libera o e-mail original
      if (u.googleSub) this.byGoogleSub.delete(u.googleSub); // solta o vínculo Google
      u.excluidoEm = quando;
      u.nome = NOME_EXCLUIDO;
      u.email = emailAnonimo(id);
      u.passwordHash = null;
      u.googleSub = null; // relogar com o mesmo Google cria conta nova (não bate na excluída)
      this.byEmail.set(u.email, u);
    }
    return Promise.resolve();
  }
  registrarAceitePolitica(id: string, versao: string, quando: Date): Promise<void> {
    const u = this.byId.get(id);
    if (u) {
      u.politicaVersao = versao;
      u.politicaAceitaEm = quando;
    }
    return Promise.resolve();
  }
}
