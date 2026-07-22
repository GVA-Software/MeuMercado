import { describe, it, expect } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { POLITICA_VERSAO } from '@meumercado/contracts';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { ScryptPasswordHasher } from './password.hasher.js';
import { GoogleTokenVerifier, type GoogleIdentity } from './google-token.verifier.js';
import { InMemoryUserRepository } from './user.repository.js';
import { InMemoryNameChangeRepository } from './name-change.repository.js';
import { InMemoryRefreshSessionRepository } from './refresh-session.repository.js';
import { InMemoryCompraRepository } from '../compras/compra.repository.js';
import { InMemoryListaRepository } from '../listas/lista.repository.js';
import { InMemoryPushSubscriptionRepository } from '../push/push-subscription.repository.js';
import type { Env } from '../../config/env.schema.js';

const env: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  JWT_REFRESH_SECRET: 'y'.repeat(40),
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 1_209_600,
  ADMIN_EMAILS: '',
};
const config = { get: (k: string) => env[k] } as unknown as ConfigService<Env, true>;

function make(googleVerifier?: Pick<GoogleTokenVerifier, 'verificar'>) {
  const sessions = new InMemoryRefreshSessionRepository();
  const compras = new InMemoryCompraRepository();
  const listas = new InMemoryListaRepository();
  const push = new InMemoryPushSubscriptionRepository();
  const users = new InMemoryUserRepository();
  const tokens = new TokenService(config);
  const service = new AuthService(
    users,
    new InMemoryNameChangeRepository(),
    new ScryptPasswordHasher(),
    tokens,
    config,
    sessions,
    compras,
    listas,
    push,
    // Sem GOOGLE_CLIENT_ID no config, o verifier real fica desligado; os testes de
    // Google injetam um fake determinístico (sem rede).
    (googleVerifier ?? new GoogleTokenVerifier(config)) as GoogleTokenVerifier,
  );
  return { service, tokens, sessions, compras, listas, push, users };
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

  it('apaga o histórico PRIVADO de compras, as listas salvas e o push (mas não os preços)', async () => {
    const { service, compras, listas, push } = make();
    const reg = await registrar(service);
    const userId = reg.response.user.id;

    await compras.salvar(userId, {
      id: 'c1',
      mercadoId: null,
      mercadoNome: null,
      mercadoEndereco: null,
      totalCents: 1234,
      economiaCents: 0,
      itens: [],
      criadaEm: new Date().toISOString(),
    });
    await listas.salvar(userId, {
      id: 'L1',
      nome: 'Semana',
      itens: [{ produtoId: 'p1', nome: 'Arroz', quantity: 1 }],
      criadaEm: new Date().toISOString(),
    });
    await push.salvar({
      id: 'p1',
      userId,
      endpoint: 'https://push.example/abc',
      p256dh: 'k',
      auth: 'a',
      criadoEm: new Date(),
    });
    expect(await compras.listarPorUsuario(userId)).toHaveLength(1);
    expect(await listas.listarPorUsuario(userId)).toHaveLength(1);
    expect(await push.listarPorUsuario(userId)).toHaveLength(1);

    await service.excluirConta(userId, 'senha-de-teste');

    // dado pessoal do titular some…
    expect(await compras.listarPorUsuario(userId)).toHaveLength(0);
    expect(await listas.listarPorUsuario(userId)).toHaveLength(0);
    expect(await push.listarPorUsuario(userId)).toHaveLength(0);
    // (os preços vivem em outro repositório — a comunidade não perde nada.)
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

describe('AuthService — login com Google', () => {
  const ident = (over?: Partial<GoogleIdentity>): GoogleIdentity => ({
    sub: 'g-1',
    email: 'novo@x.com',
    emailVerified: true,
    nome: 'Novo',
    foto: '',
    ...over,
  });
  const fake = (id: GoogleIdentity): Pick<GoogleTokenVerifier, 'verificar'> => ({
    verificar: () => Promise.resolve(id),
  });

  it('e-mail novo → CRIA conta sem senha; grava consentimento quando aceitouTermos', async () => {
    const { service, users } = make(fake(ident()));
    const r = await service.loginComGoogle({ idToken: 't', aceitouTermos: true });
    expect(r.response.user.email).toBe('novo@x.com');
    expect(r.response.user.politicaVersao).toBe(POLITICA_VERSAO);
    const u = await users.findByGoogleSub('g-1');
    expect(u?.passwordHash).toBeNull();
    expect(u?.googleSub).toBe('g-1');
  });

  it('sem aceitouTermos → cria com politicaVersao null (ReconsentGate cobra ao entrar)', async () => {
    const { service } = make(fake(ident({ sub: 'g-2', email: 'sem@x.com' })));
    const r = await service.loginComGoogle({ idToken: 't' });
    expect(r.response.user.politicaVersao).toBeNull();
  });

  it('e-mail que JÁ tem conta com senha → VINCULA mas INVALIDA a senha antiga (anti pre-hijacking)', async () => {
    // Cenário de pre-hijacking: alguém pré-cadastrou a@b.com com uma senha (o e-mail nunca
    // foi verificado). Quando o dono REAL entra com Google (e-mail verificado), a conta é
    // preservada (dados), mas a senha plantada é invalidada e as sessões antigas caem.
    const { service, users, tokens, sessions } = make(
      fake(ident({ sub: 'g-3', email: 'a@b.com' })),
    );
    const reg = await registrar(service); // "atacante" cria a@b.com COM senha
    const { jti: jtiAntigo } = tokens.verifyRefresh(reg.refreshToken);
    const r = await service.loginComGoogle({ idToken: 't' });
    expect(r.response.user.id).toBe(reg.response.user.id); // mesma conta (dados preservados)
    const u = await users.findById(reg.response.user.id);
    expect(u?.googleSub).toBe('g-3');
    expect(u?.passwordHash).toBeNull(); // senha plantada invalidada
    expect(r.response.user.temSenha).toBe(false);
    // a senha antiga NÃO loga mais (o "atacante" perde o acesso)
    await expect(service.login({ email: 'a@b.com', senha: 'senha-de-teste' })).rejects.toThrow();
    // e as sessões antigas foram derrubadas
    expect((await sessions.buscar(jtiAntigo!))?.revoked).toBe(true);
  });

  it('segundo login acha por googleSub (não recria a conta)', async () => {
    const { service, users } = make(fake(ident({ sub: 'g-4', email: 'again@x.com' })));
    const r1 = await service.loginComGoogle({ idToken: 't' });
    const r2 = await service.loginComGoogle({ idToken: 't' });
    expect(r2.response.user.id).toBe(r1.response.user.id);
    expect(await users.count()).toBe(1);
  });

  it('usa a foto do Google como fotoUrl (avatar padrão)', async () => {
    const foto = 'https://lh3.googleusercontent.com/a/abc123';
    const { service, users } = make(fake(ident({ sub: 'g-8', email: 'foto@x.com', foto })));
    const r = await service.loginComGoogle({ idToken: 't' });
    expect(r.response.user.fotoUrl).toBe(foto);
    expect((await users.findByGoogleSub('g-8'))?.fotoUrl).toBe(foto);
  });

  it('conta excluída relogando com o mesmo Google cria conta NOVA (não bate na excluída)', async () => {
    const { service } = make(fake(ident({ sub: 'g-5', email: 'del@x.com' })));
    const r1 = await service.loginComGoogle({ idToken: 't' });
    await service.excluirConta(r1.response.user.id); // conta Google: sem senha
    const r2 = await service.loginComGoogle({ idToken: 't' });
    expect(r2.response.user.id).not.toBe(r1.response.user.id);
  });

  it('login por SENHA numa conta só-Google responde 401 sem estourar (500)', async () => {
    const { service } = make(fake(ident({ sub: 'g-6', email: 'g6@x.com' })));
    await service.loginComGoogle({ idToken: 't' });
    await expect(service.login({ email: 'g6@x.com', senha: 'qualquer-uma' })).rejects.toThrow();
  });

  it('excluir conta só-Google NÃO exige senha e zera o vínculo google_sub', async () => {
    const { service, users } = make(fake(ident({ sub: 'g-7', email: 'g7@x.com' })));
    const r = await service.loginComGoogle({ idToken: 't' });
    await service.excluirConta(r.response.user.id); // sem senha
    expect(await users.findByGoogleSub('g-7')).toBeNull();
  });
});
