/**
 * Allowlist de administradores. O painel de ADM é liberado por e-mail (não por um
 * campo no banco, para não haver "escalonamento de privilégio" via dado do usuário).
 * A lista base garante acesso do dono mesmo sem configurar env; ADMIN_EMAILS (env,
 * separada por vírgula) adiciona outros.
 */
const DEFAULT_ADMINS = ['dsoaresdeavila@gmail.com', 'gustavotoiansk@icloud.com'];

function parse(csv: string): Set<string> {
  const extra = csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ADMINS, ...extra]);
}

export function isAdminEmail(email: string, adminEmailsCsv: string): boolean {
  return parse(adminEmailsCsv).has(email.trim().toLowerCase());
}
