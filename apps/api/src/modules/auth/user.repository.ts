import { Injectable } from '@nestjs/common';

export interface StoredUser {
  id: string;
  email: string;
  nome: string;
  passwordHash: string;
  criadoEm: Date;
}

/** Porta de acesso a usuários. Assíncrona (suporta memória e banco). */
export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: string): Promise<StoredUser | null>;
  create(user: StoredUser): Promise<void>;
  /** Atualiza só o nome (edição de perfil). */
  updateNome(id: string, nome: string): Promise<void>;
  /** Troca o hash de senha (usado na recuperação de senha). */
  updateSenha(id: string, passwordHash: string): Promise<void>;
  /** Todos os usuários (mais recentes primeiro) — uso administrativo. */
  findAll(): Promise<StoredUser[]>;
  count(): Promise<number>;
  delete(id: string): Promise<void>;
}

export const USER_REPOSITORY = 'USER_REPOSITORY';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, StoredUser>();
  private readonly byEmail = new Map<string, StoredUser>();

  findByEmail(email: string): Promise<StoredUser | null> {
    return Promise.resolve(this.byEmail.get(email) ?? null);
  }
  findById(id: string): Promise<StoredUser | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }
  create(user: StoredUser): Promise<void> {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user);
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
    }
    return Promise.resolve();
  }
}
