import { z } from 'zod';

/**
 * Validação das variáveis de ambiente na inicialização. Se algo obrigatório
 * faltar ou vier malformado, a API **não sobe** — falha explícita em vez de
 * comportamento silencioso e inseguro em produção.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Porta injetada pela plataforma de deploy (Render/Railway/Fly...). Tem prioridade.
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().default(3000),

  /** Origens permitidas no CORS (separadas por vírgula). */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  /** Rate limiting (Throttler). */
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  /** JWT (auth). Em produção DEVEM ser trocados (validação abaixo). */
  JWT_ACCESS_SECRET: z.string().min(1).default('dev-access-secret-troque-em-prod'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev-refresh-secret-troque-em-prod'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900), // 15 min
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1_209_600), // 14 dias
  /** Cookie de refresh como Secure (true atrás de HTTPS/Cloudflare em prod). */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /** Cloudflare Turnstile (CAPTCHA grátis). Sem chave → guard passa em dev. */
  TURNSTILE_SECRET_KEY: z.string().optional(),

  /** E-mails de administradores (separados por vírgula) — liberam o painel de ADM. */
  ADMIN_EMAILS: z.string().default(''),

  /**
   * Web Push (VAPID). Chaves default embutidas SÓ para o dev rodar sem configurar;
   * em produção DEVEM ser sobrescritas (a validação recusa o default público — a
   * privada foi exposta no repo aberto e não pode ser reutilizada). Gere um par novo
   * com `npx web-push generate-vapid-keys`.
   */
  VAPID_PUBLIC_KEY: z
    .string()
    .default(
      'BGc4QFZFZ82nLeTgLlDT0n_CYEWVmXeZM-AuzOBM4iDzqlWuD2ZEgBhjsVqPX5u-QYakvAcC4b9TdjErxA7Eiv0',
    ),
  VAPID_PRIVATE_KEY: z.string().default('Nt1nOi2pGURXIZPk3aZSgg7Ij25n1IOGNKCv-CRbxs4'),
  VAPID_SUBJECT: z.string().default('mailto:dsoaresdeavila@gmail.com'),

  /**
   * Segredo das rotas de cron (keep-warm + varredura de expiração). Default embutido
   * SÓ para dev; em produção a validação recusa o default público (deve vir do ambiente).
   */
  CRON_SECRET: z.string().default('mzv_8tNV1GBcU5qoVMFIdEBhhAPYQtm0'),

  /**
   * E-mail (opcional). SEM `SMTP_HOST` → e-mails desligados (só push). COM →
   * envia via SMTP (ex.: Gmail: host smtp.gmail.com, user o e-mail, pass um
   * "app password"). É só configurar as envs; o código já está pronto.
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Meu Mercado <no-reply@meumercado.app>'),
  /**
   * Brevo (e-mail por HTTP). Preferido no Render free (SMTP de saída é bloqueado).
   * COM esta chave → envia pelo Brevo; o remetente vem do SMTP_FROM (verifique-o no
   * Brevo). Sem ela, cai no SMTP (se configurado) ou fica desligado.
   */
  BREVO_API_KEY: z.string().optional(),

  /**
   * Postgres (TypeORM). Se definido → usa banco (dados persistem).
   * Se ausente → repositórios em memória (dev local sem banco).
   */
  DATABASE_URL: z.string().url().optional(),
  /** Cria/atualiza as tabelas automaticamente (ok para demo/1º deploy). */
  DB_SYNCHRONIZE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  /** Motores de geo (auto-hospedados). Opcionais até a aba Mapa entrar. */
  VALHALLA_URL: z.string().url().optional(),
  PHOTON_URL: z.string().url().optional(),
  NOMINATIM_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

const DEV_SECRETS = ['dev-access-secret-troque-em-prod', 'dev-refresh-secret-troque-em-prod'];

/**
 * Valores default embutidos no código — portanto PÚBLICOS (o repositório é aberto).
 * Servem só para o dev rodar sem configurar nada; em PRODUÇÃO são proibidos (a
 * validação abaixo recusa o boot), forçando segredos reais definidos no ambiente.
 */
const PUBLIC_DEFAULTS = new Set<string>([
  'mzv_8tNV1GBcU5qoVMFIdEBhhAPYQtm0', // CRON_SECRET
  'Nt1nOi2pGURXIZPk3aZSgg7Ij25n1IOGNKCv-CRbxs4', // VAPID_PRIVATE_KEY
]);

/** Usada por `ConfigModule.forRoot({ validate })`. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (parsed.success && parsed.data.NODE_ENV === 'production') {
    // Em produção, segredos default ou curtos são um erro de segurança.
    for (const s of [parsed.data.JWT_ACCESS_SECRET, parsed.data.JWT_REFRESH_SECRET]) {
      if (DEV_SECRETS.includes(s) || s.length < 32) {
        throw new Error('JWT secrets inválidos em produção: defina segredos fortes (≥32 chars).');
      }
    }
    // Cookies de sessão SEM Secure em produção trafegariam em HTTP → interceptáveis.
    if (!parsed.data.COOKIE_SECURE) {
      throw new Error('COOKIE_SECURE deve ser "true" em produção (sessão exige HTTPS).');
    }
    // Segredos com default público NÃO podem chegar a produção (repo é aberto).
    if (PUBLIC_DEFAULTS.has(parsed.data.CRON_SECRET)) {
      throw new Error('CRON_SECRET usa o default público — defina um segredo forte no ambiente.');
    }
    if (PUBLIC_DEFAULTS.has(parsed.data.VAPID_PRIVATE_KEY)) {
      throw new Error(
        'VAPID_PRIVATE_KEY usa o default público — gere um par novo (web-push) e defina no ambiente.',
      );
    }
  }
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  return parsed.data;
}

/** Lista de origens de CORS derivada da env. */
export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
