import { Injectable } from '@nestjs/common';

export interface StoredUser {
  id: string;
  email: string;
  nome: string;
  passwordHash: string;
  criadoEm: Date;
}

export interface UserRepository {
  findByEmail(email: string): StoredUser | null;
  findById(id: string): StoredUser | null;
  create(user: StoredUser): void;
}

export const USER_REPOSITORY = 'USER_REPOSITORY';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, StoredUser>();
  private readonly byEmail = new Map<string, StoredUser>();

  findByEmail(email: string): StoredUser | null {
    return this.byEmail.get(email) ?? null;
  }
  findById(id: string): StoredUser | null {
    return this.byId.get(id) ?? null;
  }
  create(user: StoredUser): void {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user);
  }
}
