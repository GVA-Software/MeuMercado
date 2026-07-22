import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Email } from '@meumercado/domain';
import {
  POLITICA_VERSAO,
  type AuthResponse,
  type GoogleLoginInput,
  type LoginInput,
  type RegisterInput,
  type UserDTO,
} from '@meumercado/contracts';
import type { Env } from '../../config/env.schema.js';
import { isAdminEmail } from '../../common/admin-emails.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password.hasher.js';
import { USER_REPOSITORY, type StoredUser, type UserRepository } from './user.repository.js';
import { NAME_CHANGE_REPOSITORY, type NameChangeRepository } from './name-change.repository.js';
import {
  REFRESH_SESSION_REPOSITORY,
  type RefreshSessionRepository,
} from './refresh-session.repository.js';
import { COMPRA_REPOSITORY, type CompraRepository } from '../compras/compra.repository.js';
import { LISTA_REPOSITORY, type ListaRepository } from '../listas/lista.repository.js';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionRepository,
} from '../push/push-subscription.repository.js';
import { TokenService } from './token.service.js';
import { GoogleTokenVerifier } from './google-token.verifier.js';

export interface AuthResult {
  response: AuthResponse;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(NAME_CHANGE_REPOSITORY) private readonly nameChanges: NameChangeRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
    @Inject(REFRESH_SESSION_REPOSITORY) private readonly sessions: RefreshSessionRepository,
    @Inject(COMPRA_REPOSITORY) private readonly compras: CompraRepository,
    @Inject(LISTA_REPOSITORY) private readonly listas: ListaRepository,
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY) private readonly push: PushSubscriptionRepository,
    private readonly googleVerifier: GoogleTokenVerifier,
  ) {}

  /**
   * Janela de graça pra corridas BENIGNAS de refresh (2 abas, ou a resposta do
   * refresh se perde bem em cima da rotação): reapresentar o token recém-rotacionado
   * dentro dela emite uma sessão nova em vez de derrubar tudo como se fosse reuso.
   */
  private readonly GRACE_MS = 15_000;

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = new Email(input.email).value; // valida + normaliza
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const user: StoredUser = {
      id: randomUUID(),
      email,
      nome: input.nome.trim(),
      passwordHash: await this.hasher.hash(input.senha),
      criadoEm: new Date(),
      politicaVersao: POLITICA_VERSAO, // consentimento LGPD registrado no cadastro
      politicaAceitaEm: new Date(),
    };
    await this.users.create(user);
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = new Email(input.email).value;
    const user = await this.users.findByEmail(email);
    // Resposta idêntica para "não existe" e "senha errada" — E mesmo custo de tempo:
    // quando o e-mail não existe, roda um scrypt "descartável" com o MESMO peso da
    // verificação real, para não vazar a existência da conta por diferença de latência
    // (oráculo de enumeração por timing).
    if (!user) {
      await this.hasher.hash(input.senha);
      throw new UnauthorizedException('Credenciais inválidas');
    }
    // Conta só-Google (sem senha): não dá pra entrar por senha. Roda um hash descartável
    // (mesmo custo de tempo) e responde igual a "senha errada" — não vaza a existência.
    if (!user.passwordHash) {
      await this.hasher.hash(input.senha);
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!(await this.hasher.verify(user.passwordHash, input.senha))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (user.excluidoEm) {
      throw new UnauthorizedException('Esta conta foi excluída.');
    }
    return this.issue(user);
  }

  /**
   * Login com Google: verifica o ID token e resolve a conta de forma determinística —
   * (1) já vinculada pelo `sub`; senão (2) e-mail VERIFICADO que já tem conta → VINCULA
   * (mantém a conta e a senha, só grava o google_sub); senão (3) cria conta nova (sem
   * senha). Converge na MESMA emissão de tokens/cookie do login por senha.
   */
  async loginComGoogle(input: GoogleLoginInput): Promise<AuthResult> {
    const identidade = await this.googleVerifier.verificar(input.idToken);
    const email = new Email(identidade.email).value; // valida + normaliza

    const porSub = await this.users.findByGoogleSub(identidade.sub);
    if (porSub && !porSub.excluidoEm) return this.issue(porSub);

    const porEmail = await this.users.findByEmail(email);
    if (porEmail && !porEmail.excluidoEm) {
      await this.users.vincularGoogle(porEmail.id, identidade.sub);
      porEmail.googleSub = identidade.sub;
      return this.issue(porEmail);
    }

    const consentiu = input.aceitouTermos === true;
    const novo: StoredUser = {
      id: randomUUID(),
      email,
      nome: identidade.nome.trim() || email,
      passwordHash: null, // conta só-Google
      googleSub: identidade.sub,
      criadoEm: new Date(),
      // Consentimento LGPD: se não veio o aceite, fica null e o ReconsentGate cobra ao entrar.
      politicaVersao: consentiu ? POLITICA_VERSAO : null,
      politicaAceitaEm: consentiu ? new Date() : null,
    };
    await this.users.create(novo);
    return this.issue(novo);
  }

  async me(userId: string): Promise<UserDTO> {
    const user = await this.users.findById(userId);
    if (!user || user.excluidoEm) throw new UnauthorizedException();
    return this.toDTO(user);
  }

  /**
   * Exclui a PRÓPRIA conta: confirma a senha e faz a limpeza LGPD.
   *
   * FICA (base comunitária, anonimizado): os PREÇOS que o usuário cadastrou —
   * preço é fato, não é dado pessoal; ao anonimizar a conta o vínculo com a
   * identidade some, e a LGPD (art. 16) permite manter o dado nesse caso.
   *
   * SAI (dado pessoal do titular): a conta é anonimizada (nome/e-mail/hash), as
   * sessões são derrubadas, o histórico PRIVADO de compras é apagado e as
   * inscrições de notificação (push) são removidas — para não notificar quem saiu.
   */
  async excluirConta(userId: string, senha?: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (user.excluidoEm) return; // idempotente
    // Conta com senha: confirma a senha. Conta só-Google (sem senha): dispensa a
    // confirmação — o usuário já está autenticado por JWT (não há senha a conferir).
    if (user.passwordHash) {
      if (!senha || !(await this.hasher.verify(user.passwordHash, senha))) {
        throw new UnauthorizedException('Senha incorreta.');
      }
    }
    await this.users.marcarExcluido(user.id, new Date());
    await this.sessions.revogarTodasDoUsuario(user.id);
    await this.compras.excluirTodas(user.id); // histórico pessoal de gastos (privado)
    await this.listas.excluirTodas(user.id); // listas salvas (dado pessoal privado)
    await this.push.removerTodasDoUsuario(user.id); // não notificar mais
  }

  /**
   * Registra o REACEITE da Política/Termos quando a versão muda (mudança material).
   * Grava a nova versão + a data, e devolve o perfil atualizado.
   */
  async aceitarPolitica(userId: string): Promise<UserDTO> {
    const user = await this.users.findById(userId);
    if (!user || user.excluidoEm) throw new UnauthorizedException();
    await this.users.registrarAceitePolitica(user.id, POLITICA_VERSAO, new Date());
    user.politicaVersao = POLITICA_VERSAO;
    return this.toDTO(user);
  }

  /** Atualiza o nome do próprio usuário e guarda a alteração na trilha de auditoria. */
  async updateNome(userId: string, nome: string): Promise<UserDTO> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const novo = nome.trim();
    if (novo && novo !== user.nome) {
      await this.nameChanges.registrar({
        id: randomUUID(),
        userId: user.id,
        nomeAnterior: user.nome,
        nomeNovo: novo,
        alteradoEm: new Date(),
      });
      await this.users.updateNome(user.id, novo);
      user.nome = novo;
    }
    return this.toDTO(user);
  }

  /**
   * Renova a sessão ROTACIONANDO o refresh token, com detecção de reuso:
   * - jti desconhecido/expirado/de outro usuário → inválido (401).
   * - jti de uma sessão VÁLIDA → emite tokens novos e revoga o atual (rotação).
   * - jti de uma sessão JÁ REVOGADA → é um token reapresentado:
   *     · se foi rotacionado agora há pouco (janela de graça) → corrida benigna,
   *       emite sessão nova sem derrubar nada;
   *     · senão → provável ROUBO: revoga TODAS as sessões do usuário e recusa.
   */
  async refresh(userId: string, jti: string | undefined): Promise<AuthResult> {
    if (!jti) throw new UnauthorizedException('Sessão inválida');
    const s = await this.sessions.buscar(jti);
    const agora = Date.now();
    if (!s || s.userId !== userId || s.expiresAt.getTime() < agora) {
      throw new UnauthorizedException('Sessão inválida');
    }
    if (s.revoked) {
      const rotacaoRecente =
        s.replacedByJti !== null &&
        s.revokedAt !== null &&
        agora - s.revokedAt.getTime() < this.GRACE_MS;
      if (rotacaoRecente) {
        return (await this.novaSessao(await this.exigirUsuario(userId))).result;
      }
      // Reuso de token revogado = provável roubo → derruba a família inteira.
      await this.sessions.revogarTodasDoUsuario(userId);
      throw new UnauthorizedException('Sessão revogada');
    }
    // Sessão válida → rotaciona: cria a nova e revoga a atual apontando pra ela.
    const user = await this.exigirUsuario(userId);
    const { result, jti: novoJti } = await this.novaSessao(user);
    await this.sessions.revogar(jti, novoJti);
    return result;
  }

  /** Encerra a sessão de verdade no servidor (revoga o refresh), não só o cookie. */
  async logout(jti: string | undefined): Promise<void> {
    if (jti) await this.sessions.revogar(jti, null);
  }

  private async exigirUsuario(userId: string): Promise<StoredUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  /** Cria uma sessão de refresh nova e emite os tokens dela. */
  private async novaSessao(user: StoredUser): Promise<{ result: AuthResult; jti: string }> {
    const jti = randomUUID();
    await this.sessions.criar({
      jti,
      userId: user.id,
      revoked: false,
      revokedAt: null,
      replacedByJti: null,
      expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs),
      criadoEm: new Date(),
    });
    return {
      result: {
        response: {
          accessToken: this.tokens.signAccess({ sub: user.id, email: user.email }),
          user: this.toDTO(user),
        },
        refreshToken: this.tokens.signRefresh(user.id, jti),
      },
      jti,
    };
  }

  private async issue(user: StoredUser): Promise<AuthResult> {
    return (await this.novaSessao(user)).result;
  }

  private toDTO(user: StoredUser): UserDTO {
    return {
      id: user.id,
      email: user.email,
      nome: user.nome,
      isAdmin: isAdminEmail(user.email, this.config.get('ADMIN_EMAILS', { infer: true })),
      politicaVersao: user.politicaVersao ?? null,
    };
  }
}
