import { describe, it, expect } from 'vitest';
import { Assinatura } from './Assinatura.js';

const now = new Date('2025-06-01T12:00:00Z');
const plus = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

describe('Assinatura', () => {
  it('free nunca é Pro', () => {
    expect(Assinatura.free('u1').isProAtivo(now)).toBe(false);
  });

  it('trial é Pro até expirar', () => {
    const s = Assinatura.iniciarTrial('u1', now, 7);
    expect(s.isProAtivo(now)).toBe(true);
    expect(s.emTrial(now)).toBe(true);
    expect(s.diasRestantes(now)).toBe(7);
    expect(s.isProAtivo(plus(8))).toBe(false); // expirou
  });

  it('assinatura ativa é Pro dentro do período', () => {
    const s = Assinatura.free('u1').ativar('mensal', now);
    expect(s.isProAtivo(now)).toBe(true);
    expect(s.isProAtivo(plus(29))).toBe(true);
    expect(s.isProAtivo(plus(31))).toBe(false);
    expect(s.periodo).toBe('mensal');
  });

  it('anual dura ~365 dias', () => {
    const s = Assinatura.free('u1').ativar('anual', now);
    expect(s.isProAtivo(plus(300))).toBe(true);
    expect(s.isProAtivo(plus(366))).toBe(false);
  });

  it('cancelada deixa de ser Pro', () => {
    const s = Assinatura.free('u1').ativar('mensal', now).cancelar();
    expect(s.status).toBe('cancelada');
    expect(s.isProAtivo(now)).toBe(false);
  });

  it('transições não mutam a instância original', () => {
    const trial = Assinatura.iniciarTrial('u1', now);
    trial.ativar('anual', now);
    expect(trial.status).toBe('trial'); // original intacto
  });
});
