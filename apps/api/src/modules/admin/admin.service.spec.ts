import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Assinatura } from '@meumercado/domain';
import type { Env } from '../../config/env.schema.js';
import type { AuthedUser } from '../auth/jwt-auth.guard.js';
import type { StoredUser, UserRepository } from '../auth/user.repository.js';
import type { PushService } from '../push/push.service.js';
import type { AnalyticsRepository } from '../analytics/analytics.repository.js';
import type { PriceObservationRepository } from '../pricing/price-observation.repository.js';
import type { ProdutoRepository } from '../catalog/produtos.repository.js';
import { BillingService } from '../billing/billing.service.js';
import type { EmailService } from '../email/email.service.js';
import { AdminService } from './admin.service.js';

const user = (id: string, email: string): StoredUser => ({
  id,
  email,
  nome: 'Fulano',
  passwordHash: 'x',
  criadoEm: new Date('2026-07-01T00:00:00Z'),
});

const ACTING: AuthedUser = { id: 'me', email: 'admin@test.dev' };

function makeService(
  usuarios: StoredUser[],
  extra: {
    resumo?: Array<{ name: string; usuarios: number; total: number }>;
    vistos?: string[];
    observacoes?: Array<{
      id?: string;
      reporterId: string;
      produtoId?: string;
      mercadoId?: string;
      mercadoNome?: string;
      mercadoEndereco?: string;
      observedAt?: Date;
    }>;
    produtos?: Array<{ id: string; nome: string; categoria?: string }>;
    proAtivo?: boolean;
    emailLigado?: boolean;
    atualizarOk?: boolean;
  } = {},
) {
  const deleted: string[] = [];
  const users: UserRepository = {
    findByEmail: () => Promise.resolve(null),
    findById: (id) => Promise.resolve(usuarios.find((u) => u.id === id) ?? null),
    create: () => Promise.resolve(),
    updateNome: () => Promise.resolve(),
    findAll: () => Promise.resolve(usuarios),
    count: () => Promise.resolve(usuarios.length),
    delete: (id) => {
      deleted.push(id);
      return Promise.resolve();
    },
  };
  const assinatura = Assinatura.free('x');
  const proAtivo = { isProAtivo: () => true } as unknown as Assinatura;
  const billing = {
    forUser: vi.fn(() => Promise.resolve(extra.proAtivo ? proAtivo : assinatura)),
    mapaResolvido: (ids: string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, extra.proAtivo ? proAtivo : assinatura]))),
    toDTO: vi.fn(() => ({
      usuarioId: 'x',
      plano: 'free' as const,
      periodo: null,
      status: 'ativa' as const,
      isPro: false,
      diasRestantes: 0,
      trialFim: null,
      periodoFim: null,
    })),
    iniciarTrial: vi.fn(() => Promise.resolve(assinatura)),
    assinar: vi.fn(() => Promise.resolve(assinatura)),
    cancelar: vi.fn(() => Promise.resolve(assinatura)),
  };
  const push = { enviarPara: vi.fn(() => Promise.resolve()) };
  const config = { get: () => 'admin@test.dev' } as unknown as ConfigService<Env, true>;
  const analytics = {
    registrar: vi.fn(() => Promise.resolve()),
    resumo: () => Promise.resolve(extra.resumo ?? []),
    usuariosComEvento: () => Promise.resolve(extra.vistos ?? []),
  } as unknown as AnalyticsRepository;
  const precosApagados: string[] = [];
  const produtosApagados: string[] = [];
  const mercadosApagados: string[] = [];
  const precosEditados: Array<[string, number]> = [];
  const produtosEditados: Array<[string, string, string]> = [];
  const produtosCriados: Array<{ id: string; nome: string }> = [];
  const obsMovidas: Array<[string, string]> = [];
  const reassignsMercado: Array<[string, string, string, string | null]> = [];
  const prices = {
    all: () => Promise.resolve(extra.observacoes ?? []),
    findByProduto: (pid: string) =>
      Promise.resolve((extra.observacoes ?? []).filter((o) => o.produtoId === pid)),
    moverObservacao: (obsId: string, pid: string) => {
      obsMovidas.push([obsId, pid]);
      return Promise.resolve();
    },
    deleteByProduto: (id: string) => {
      precosApagados.push(id);
      return Promise.resolve();
    },
    deleteByMercado: (id: string) => {
      mercadosApagados.push(id);
      return Promise.resolve();
    },
    reassignMercado: (from: string, to: string, nome: string, endereco: string | null) => {
      reassignsMercado.push([from, to, nome, endereco]);
      return Promise.resolve();
    },
    updatePreco: (id: string, cents: number) => {
      precosEditados.push([id, cents]);
      return Promise.resolve();
    },
  } as unknown as PriceObservationRepository;
  const produtos = {
    findAll: () => Promise.resolve(extra.produtos ?? []),
    findById: (id: string) =>
      Promise.resolve((extra.produtos ?? []).find((p) => p.id === id) ?? null),
    add: (p: { id: string; nome: string }) => {
      produtosCriados.push({ id: p.id, nome: p.nome });
      return Promise.resolve();
    },
    atualizar: (id: string, campos: { nome: string; categoria: string }) => {
      produtosEditados.push([id, campos.nome, campos.categoria]);
      return Promise.resolve(extra.atualizarOk ?? true);
    },
    delete: (id: string) => {
      produtosApagados.push(id);
      return Promise.resolve();
    },
  } as unknown as ProdutoRepository;
  const email = {
    enviar: () => Promise.resolve(),
    estaLigado: () => extra.emailLigado ?? false,
    enviarTeste: vi.fn(() => Promise.resolve()),
  };
  const service = new AdminService(
    users,
    billing as unknown as BillingService,
    push as unknown as PushService,
    config,
    analytics,
    prices,
    produtos,
    email as unknown as EmailService,
  );
  return {
    service,
    deleted,
    push,
    billing,
    email,
    precosApagados,
    produtosApagados,
    mercadosApagados,
    precosEditados,
    produtosEditados,
    produtosCriados,
    obsMovidas,
    reassignsMercado,
  };
}

describe('AdminService — testar e-mail', () => {
  it('e-mail desligado → rejeita com instrução de configurar SMTP', async () => {
    const { service } = makeService([], { emailLigado: false });
    await expect(service.testarEmail('adm@x.com')).rejects.toThrow(/SMTP/);
  });

  it('e-mail ligado → envia o teste para o próprio ADM', async () => {
    const { service, email } = makeService([], { emailLigado: true });
    const r = await service.testarEmail('adm@x.com');
    expect(email.enviarTeste).toHaveBeenCalledWith('adm@x.com');
    expect(r.mensagem).toContain('adm@x.com');
  });
});

describe('AdminService — cobertura', () => {
  it('agrega produtos × mercados e ranqueia contribuidores (seed conta na cobertura, não no ranking)', async () => {
    const d = new Date('2026-07-05T00:00:00Z');
    const { service } = makeService([user('u1', 'u1@x.com'), user('u2', 'u2@x.com')], {
      produtos: [
        { id: 'p1', nome: 'Arroz', categoria: 'Graos' },
        { id: 'p2', nome: 'Feijao', categoria: 'Graos' },
        { id: 'p3', nome: 'Cafe', categoria: 'Bebidas' }, // sem preço
      ],
      observacoes: [
        {
          reporterId: 'u1',
          produtoId: 'p1',
          mercadoId: 'm1',
          mercadoNome: 'A',
          mercadoEndereco: 'Rua 1',
          observedAt: d,
        },
        { reporterId: 'u1', produtoId: 'p1', mercadoId: 'm2', mercadoNome: 'B', observedAt: d },
        { reporterId: 'u2', produtoId: 'p2', mercadoId: 'm1', mercadoNome: 'A', observedAt: d },
        { reporterId: 'seed', produtoId: 'p2', mercadoId: 'm1', mercadoNome: 'A', observedAt: d },
      ],
    });

    const c = await service.cobertura();
    expect(c.totais).toMatchObject({
      produtosCatalogo: 3,
      produtosComPreco: 2, // p1, p2
      produtosMultiMercado: 1, // só p1 (2 mercados)
      mercados: 2, // m1, m2
      precos: 4,
      contribuidores: 2, // u1, u2 (seed fora)
    });
    // Rasos primeiro: p3 (0 mercados) encabeça a lista.
    expect(c.produtos[0]!.id).toBe('p3');
    expect(c.produtos.find((p) => p.id === 'p1')).toMatchObject({ mercados: 2, precos: 2 });
    // Tags de mercado no produto (nomes, ordenados).
    expect(c.produtos.find((p) => p.id === 'p1')!.mercadosNomes).toEqual(['A', 'B']);
    // Endereço do mercado propagado.
    expect(c.mercados.find((m) => m.id === 'm1')!.endereco).toBe('Rua 1');
    // Ranking: u1 (2) > u2 (1); seed nunca aparece.
    expect(c.topUsuarios[0]).toMatchObject({ userId: 'u1', cadastros: 2 });
    expect(c.topUsuarios.map((t) => t.userId)).not.toContain('seed');
  });
});

describe('AdminService — excluir produtos', () => {
  it('exclui em lote: apaga os preços e o produto; ignora ids inexistentes', async () => {
    const { service, precosApagados, produtosApagados } = makeService([], {
      produtos: [
        { id: 'p1', nome: 'A' },
        { id: 'p2', nome: 'B' },
      ],
    });
    const r = await service.excluirProdutos(['p1', 'p2', 'fantasma']);
    expect(r.excluidos).toBe(2); // fantasma ignorado
    expect(precosApagados).toEqual(['p1', 'p2']); // preços apagados antes do produto
    expect(produtosApagados).toEqual(['p1', 'p2']);
  });
});

describe('AdminService — juntar mercados', () => {
  const d = new Date('2026-07-05T00:00:00Z');

  it('move os preços pro destino, adotando o nome e preservando o endereço dele', async () => {
    const { service, reassignsMercado } = makeService([], {
      observacoes: [
        {
          reporterId: 'u1',
          produtoId: 'p1',
          mercadoId: 'm1',
          mercadoNome: 'CARREFOUR LTDA',
          mercadoEndereco: 'Av X',
          observedAt: d,
        },
        {
          reporterId: 'u1',
          produtoId: 'p2',
          mercadoId: 'm2',
          mercadoNome: 'Carrefour',
          observedAt: d,
        },
      ],
    });
    const r = await service.juntarMercados('m1', ['m2']);
    expect(r.mercados).toBe(1);
    expect(reassignsMercado).toEqual([['m2', 'm1', 'CARREFOUR LTDA', 'Av X']]);
  });

  it('herda o endereço do grupo mesmo mantendo o mercado que estava sem endereço', async () => {
    const { service, reassignsMercado } = makeService([], {
      observacoes: [
        {
          reporterId: 'u1',
          produtoId: 'p1',
          mercadoId: 'm1',
          mercadoNome: 'Carrefour',
          observedAt: d,
        },
        {
          reporterId: 'u1',
          produtoId: 'p2',
          mercadoId: 'm2',
          mercadoNome: 'CARREFOUR LTDA',
          mercadoEndereco: 'Av X',
          observedAt: d,
        },
      ],
    });
    await service.juntarMercados('m1', ['m2']);
    expect(reassignsMercado[0]).toEqual(['m2', 'm1', 'Carrefour', 'Av X']);
  });

  it('excluir mercados apaga os preços deles e conta certo; ignora ids fantasma', async () => {
    const { service, mercadosApagados } = makeService([], {
      observacoes: [
        { reporterId: 'u1', produtoId: 'p1', mercadoId: 'm1', observedAt: d },
        { reporterId: 'u1', produtoId: 'p2', mercadoId: 'm1', observedAt: d },
        { reporterId: 'u1', produtoId: 'p3', mercadoId: 'm2', observedAt: d },
      ],
    });
    const r = await service.excluirMercados(['m1', 'fantasma']);
    expect(r).toEqual({ mercados: 1, precos: 2 }); // m1 tinha 2 preços; fantasma ignorado
    expect(mercadosApagados).toEqual(['m1']);
  });
});

describe('AdminService — editar produto e preço', () => {
  const d = new Date('2026-07-05T00:00:00Z');

  it('editarProduto atualiza nome/categoria de um produto existente', async () => {
    const { service, produtosEditados } = makeService([], {
      produtos: [{ id: 'p1', nome: 'ARROZ 1KG' }],
    });
    await service.editarProduto('p1', '  ARROZ 5KG  ', 'Graos');
    expect(produtosEditados).toEqual([['p1', 'ARROZ 5KG', 'Graos']]); // nome trimado
  });

  it('editarProduto rejeita produto inexistente', async () => {
    const { service } = makeService([], { produtos: [] });
    await expect(service.editarProduto('nada', 'X', 'Outros')).rejects.toThrow(/não encontrado/i);
  });

  it('editarProduto rejeita quando o repo não consegue atualizar (ex.: removido)', async () => {
    const { service } = makeService([], {
      produtos: [{ id: 'p9', nome: 'X' }],
      atualizarOk: false,
    });
    await expect(service.editarProduto('p9', 'Novo', 'Outros')).rejects.toThrow(
      /não foi possível/i,
    );
  });

  it('editarPreco corrige o valor de um reporte existente', async () => {
    const { service, precosEditados } = makeService([], {
      observacoes: [
        { id: 'obs1', reporterId: 'u1', produtoId: 'p1', mercadoId: 'm1', observedAt: d },
      ],
    });
    await service.editarPreco('obs1', 159);
    expect(precosEditados).toEqual([['obs1', 159]]);
  });

  it('editarPreco rejeita reporte inexistente', async () => {
    const { service } = makeService([], { observacoes: [] });
    await expect(service.editarPreco('fantasma', 100)).rejects.toThrow(/não encontrado/i);
  });

  it('separarPreco cria produto novo e move o reporte pra ele', async () => {
    const { service, produtosCriados, obsMovidas } = makeService([], {
      produtos: [{ id: 'p1', nome: 'CR.DENTAL' }],
      observacoes: [
        { id: 'obs1', reporterId: 'u1', produtoId: 'p1', mercadoId: 'm1', observedAt: d },
      ],
    });
    await service.separarPreco('obs1', '  CR.DENTAL 180g  ');
    expect(produtosCriados.length).toBe(1);
    expect(produtosCriados[0]!.nome).toBe('CR.DENTAL 180g'); // trimado
    expect(obsMovidas).toEqual([['obs1', produtosCriados[0]!.id]]);
  });

  it('separarPreco rejeita reporte inexistente', async () => {
    const { service } = makeService([], { observacoes: [] });
    await expect(service.separarPreco('fantasma', 'X')).rejects.toThrow(/não encontrado/i);
  });

  it('classificarProdutos define a categoria de vários (mantém o nome; ignora fantasma)', async () => {
    const { service, produtosEditados } = makeService([], {
      produtos: [
        { id: 'p1', nome: 'BISC OREO' },
        { id: 'p2', nome: 'CHOC LACTA' },
      ],
    });
    const r = await service.classificarProdutos(['p1', 'p2', 'fantasma'], 'Doces');
    expect(r.classificados).toBe(2);
    expect(produtosEditados).toEqual([
      ['p1', 'BISC OREO', 'Doces'],
      ['p2', 'CHOC LACTA', 'Doces'],
    ]);
  });
});

describe('AdminService — guardas de duplicados e trial', () => {
  it('juntarDuplicados rejeita manterId que não existe (evita preços órfãos)', async () => {
    const { service } = makeService([], { produtos: [{ id: 'a', nome: 'A' }] });
    await expect(service.juntarDuplicados('inexistente', ['a'])).rejects.toThrow();
  });

  it('concederTrial rejeita se o usuário já é Pro ativo (não rebaixa)', async () => {
    const { service } = makeService([user('u1', 'u1@x.com')], { proAtivo: true });
    await expect(service.concederTrial('u1')).rejects.toThrow();
  });
});

describe('AdminService — proteções de exclusão', () => {
  it('não deixa o admin excluir a si mesmo', async () => {
    const { service } = makeService([user('me', 'admin@test.dev')]);
    await expect(service.excluir('me', ACTING)).rejects.toThrow();
  });

  it('não deixa excluir outro administrador', async () => {
    const { service } = makeService([user('outro', 'admin@test.dev')]);
    await expect(service.excluir('outro', ACTING)).rejects.toThrow();
  });

  it('exclui um usuário comum', async () => {
    const { service, deleted } = makeService([user('joe', 'joe@exemplo.com')]);
    await service.excluir('joe', ACTING);
    expect(deleted).toEqual(['joe']);
  });

  it('erro ao excluir usuário inexistente', async () => {
    const { service } = makeService([]);
    await expect(service.excluir('ninguem', ACTING)).rejects.toThrow();
  });
});

describe('AdminService — conceder plano', () => {
  it('concede teste da Nina e avisa por push', async () => {
    const { service, push, billing } = makeService([user('joe', 'joe@exemplo.com')]);
    await service.concederTrial('joe');
    expect(billing.iniciarTrial).toHaveBeenCalledWith('joe');
    expect(push.enviarPara).toHaveBeenCalledOnce();
  });
});

describe('AdminService — QA de conversação', () => {
  it('roda o auditor sobre o catálogo vivo e reporta as lentes', async () => {
    const { service } = makeService([], {
      produtos: [
        { id: 'cafe1', nome: 'CAFE 3CORACOES' },
        { id: 'cafe2', nome: 'CAFE MELITTA 500G TRAD' },
      ],
    });
    const r = await service.qaConversa();
    expect(r.totalProdutos).toBe(2);
    expect(r.porLente.map((l) => l.lente).sort()).toEqual([
      'busca',
      'cobertura',
      'copy',
      'edge',
      'fluxo',
    ]);
    expect(typeof r.geradoEm).toBe('string');
  });
});

describe('AdminService — duplicados', () => {
  it('agrupa produtos com a mesma chave (nome diferente) e ignora únicos', async () => {
    const { service } = makeService([], {
      produtos: [
        { id: 'a', nome: 'PAO PANCO 500G FORMA' },
        { id: 'b', nome: 'PAO FORMA PANCO 500G U' },
        { id: 'c', nome: 'ARROZ CAMIL 5KG' },
      ],
      observacoes: [{ reporterId: 'u1', produtoId: 'a', mercadoId: 'm1' }],
    });
    const { grupos } = await service.duplicados();
    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.produtos.map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(grupos[0]!.produtos.find((p) => p.id === 'a')!.precos).toBe(1);
  });
});

describe('AdminService — funil de ativação', () => {
  it('conta onboarding, registros (sem seed) e a coorte que viu e registrou', async () => {
    const { service } = makeService([user('u1', 'a@a.com'), user('u2', 'b@b.com')], {
      resumo: [
        { name: 'onboarding_visto', usuarios: 2, total: 3 },
        { name: 'onboarding_cta_registrar', usuarios: 1, total: 1 },
      ],
      vistos: ['u1', 'u2'],
      observacoes: [{ reporterId: 'u1' }, { reporterId: 'u1' }, { reporterId: 'seed' }],
    });
    const f = await service.funil();
    expect(f.totalUsuarios).toBe(2);
    expect(f.onboardingVistos).toBe(2);
    expect(f.clicaramRegistrar).toBe(1);
    expect(f.registraramPreco).toBe(1); // u1 distinto; seed excluído
    expect(f.vistosQueRegistraram).toBe(1); // u1 viu E registrou
  });
});
