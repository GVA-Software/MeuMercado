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

  /** Motores de geo (auto-hospedados). Opcionais até a aba Mapa entrar. */
  VALHALLA_URL: z.string().url().optional(),
  PHOTON_URL: z.string().url().optional(),
  NOMINATIM_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

const DEV_SECRETS = ['dev-access-secret-troque-em-prod', 'dev-refresh-secret-troque-em-prod'];

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
