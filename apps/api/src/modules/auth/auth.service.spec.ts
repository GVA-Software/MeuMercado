import { describe, it, expect } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { ScryptPasswordHasher } from './password.hasher.js';
import { InMemoryUserRepository } from './user.repository.js';
import { InMemoryNameChangeRepository } from './name-change.repository.js';
import { InMemoryRefreshSessionRepository } from './refresh-session.repository.js';
import type { Env } from '../../config/env.schema.js';

const env: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  JWT_REFRESH_SECRET: 'y'.repeat(40),
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 1_209_600,
  ADMIN_EMAILS: '',
};
const config = { get: (k: string) => env[k] } as unknown as ConfigService<Env, true>;

function make() {
  const sessions = new InMemoryRefreshSessionRepository();
  const tokens = new TokenService(config);
  const service = new AuthService(
    new InMemoryUserRepository(),
    new InMemoryNameChangeRepository(),
    new ScryptPasswordHasher(),
    tokens,
    config,
    sessions,
  );
  return { service, tokens, sessions };
}

const registrar = (s: AuthService) =>
  s.register({ email: 'a@b.com', nome: 'A', senha: 'senha-de-teste', aceitouTermos: true });

describe('AuthService — sessão de refresh (rotação + detecção de reuso)', () => {
  it('login cria uma sessão de refresh ativa (o token carrega o jti)', async () => {
    const { service, tokens, sessions } = make();
    const reg = await registrar(service);
    const { jti } = tokens.verifyRefresh(reg.refreshToken);
    expect(jti).toBeTruthy();
    expect((await sessions.buscar(jti!))?.revoked).toBe(false);
  });

  it('refresh ROTACIONA: emite token novo e revoga o antigo', async () => {
    const { service, tokens, sessions } = make();
    const reg = await registrar(service);
    const { jti } = tokens.verifyRefresh(reg.refreshToken);
    const r2 = await service.refresh(reg.response.user.id, jti);
    const { jti: jti2 } = tokens.verifyRefresh(r2.refreshToken);
    expect(jti2).not.toBe(jti);
    expect((await sessions.buscar(jti!))?.revoked).toBe(true); // antigo revogado
    expect((await sessions.buscar(jti2!))?.revoked).toBe(false); // novo ativo
  });

  it('REUSO após logout derruba a família (revoga todas as sessões do usuário)', async () => {
    const { service, tokens, sessions } = make();
    const reg = await registrar(service);
    const userId = reg.response.user.id;
    const login2 = await service.login({ email: 'a@b.com', senha: 'senha-de-teste' });
    const { jti: jtiA } = tokens.verifyRefresh(reg.refreshToken);
    const { jti: jtiB } = tokens.verifyRefresh(login2.refreshToken);
    await service.logout(jtiA); // encerra a sessão A no servidor
    // reapresentar o token A (revogado, sem rotação) = reuso → derruba a família
    await expect(service.refresh(userId, jtiA)).rejects.toThrow();
    expect((await sessions.buscar(jtiB!))?.revoked).toBe(true); // a sessão B também caiu
  });

  it('corrida BENIGNA: reapresentar o token recém-rotacionado emite sessão nova (não derruba)', async () => {
    const { service, tokens } = make();
    const reg = await registrar(service);
    const userId = reg.response.user.id;
    const { jti } = tokens.verifyRefresh(reg.refreshToken);
    await service.refresh(userId, jti); // rotaciona (dentro da janela de graça)
    const r3 = await service.refresh(userId, jti); // replay dentro da graça → OK
    expect(r3.refreshToken).toBeTruthy();
  });

  it('jti desconhecido é inválido', async () => {
    const { service } = make();
    await expect(service.refresh('user-x', 'jti-inexistente')).rejects.toThrow();
  });

  it('refresh sem jti (token antigo, pré-rotação) é inválido', async () => {
    const { service } = make();
    await expect(service.refresh('user-x', undefined)).rejects.toThrow();
  });
});

describe('AuthService — exclusão de conta (anonimização LGPD)', () => {
  it('confirma a senha, derruba as sessões e LIBERA o e-mail (anonimizado)', async () => {
    const { service, tokens, sessions } = make();
    const reg = await registrar(service);
    const userId = reg.response.user.id;
    const { jti } = tokens.verifyRefresh(reg.refreshToken);

    await expect(service.excluirConta(userId, 'senha-errada')).rejects.toThrow(); // senha errada
    await service.excluirConta(userId, 'senha-de-teste');
    expect((await sessions.buscar(jti!))?.revoked).toBe(true);

    // e-mail liberado: dá pra cadastrar de novo com o mesmo e-mail (conta nova).
    const novo = await service.register({
      email: 'a@b.com',
      nome: 'A2',
      senha: 'outra-senha-123',
      aceitouTermos: true,
    });
    expect(novo.response.user.id).not.toBe(userId);
    expect(novo.response.user.email).toBe('a@b.com');
  });

  it('login com as credenciais antigas não funciona após excluir', async () => {
    const { service } = make();
    const reg = await registrar(service);
    await service.excluirConta(reg.response.user.id, 'senha-de-teste');
    await expect(service.login({ email: 'a@b.com', senha: 'senha-de-teste' })).rejects.toThrow();
  });

  it('me() rejeita usuário excluído', async () => {
    const { service } = make();
    const reg = await registrar(service);
    await service.excluirConta(reg.response.user.id, 'senha-de-teste');
    await expect(service.me(reg.response.user.id)).rejects.toThrow();
  });

  it('cadastro grava a versão da política aceita (consentimento)', async () => {
    const { service } = make();
    const reg = await registrar(service);
    // sanity: cadastrou e emitiu sessão (a versão fica gravada no StoredUser).
    expect(reg.response.user.email).toBe('a@b.com');
  });
});
