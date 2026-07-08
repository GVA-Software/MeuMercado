import { InvalidEmailError } from '../errors.js';

// Validação pragmática (não RFC-completa): suficiente para bloquear lixo óbvio.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail imutável, normalizado (minúsculas, sem espaços). Value object. */
export class Email {
  readonly value: string;

  constructor(raw: string) {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length > 254 || !EMAIL_RE.test(normalized)) {
      throw new InvalidEmailError(`E-mail inválido: ${raw}`);
    }
    this.value = normalized;
    Object.freeze(this);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
