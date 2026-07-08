import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** Porta de hashing de senha (implementação trocável). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hashed: string, plain: string): Promise<boolean>;
}

export const PASSWORD_HASHER = 'PASSWORD_HASHER';

/** Argon2id — algoritmo recomendado para senhas (resistente a GPU/ASIC). */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      return false;
    }
  }
}
