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
}
