import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;
const SALT_BYTES = 16;

/** Porta de hashing de senha (implementação trocável). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hashed: string, plain: string): Promise<boolean>;
}

export const PASSWORD_HASHER = 'PASSWORD_HASHER';

/**
 * Hashing com **scrypt** (embutido no Node — sem dependência nativa, roda em
 * qualquer runtime, inclusive serverless/Vercel). scrypt é um KDF resistente a
 * hardware, adequado para senhas. Formato guardado: `salt:hashHex`.
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
    return `${salt.toString('hex')}:${derived.toString('hex')}`;
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    const [saltHex, keyHex] = hashed.split(':');
    if (!saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    const derived = (await scryptAsync(plain, salt, expected.length)) as Buffer;
    // Comparação em tempo constante (evita timing attacks).
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }
}
