/**
 * Templates de e-mail (assunto + texto puro + HTML). O HTML segue o padrão visual do
 * app (laranja #FF6B2B, logo 🛒) para passar credibilidade; o texto é o fallback para
 * clientes que não renderizam HTML. Layout em tabela + estilos inline (compatível com
 * Gmail/Apple Mail/Outlook).
 */

const PRIMARY = '#FF6B2B';
const BG = '#FAFAF7';
const CARD = '#FFFFFF';
const BORDER = '#E8E6DF';
const TEXT = '#1A1A1A';
const SUB = '#555555';
const MUTED = '#6E6E6E';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escapa texto do usuário para interpolar com segurança no HTML. */
function esc(s: string): string {
  const mapa: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return s.replace(/[&<>"']/g, (c) => mapa[c] ?? c);
}

/** Casca padrão (cabeçalho com a marca + rodapé) em volta do miolo. */
function casca(miolo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${CARD};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;font-family:${FONT};">
        <tr><td style="padding:28px 28px 4px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:${PRIMARY};letter-spacing:-0.2px;">🛒 Meu Mercado</div>
        </td></tr>
        ${miolo}
      </table>
      <p style="max-width:480px;margin:14px auto 0;font-size:11px;line-height:1.5;color:${MUTED};text-align:center;font-family:${FONT};">
        Você recebeu este e-mail porque tem uma conta no Meu Mercado.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

/** Botão "bulletproof" (tabela) no laranja da marca. */
function botao(texto: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
    <td style="border-radius:12px;background:${PRIMARY};">
      <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:12px;">${texto}</a>
    </td></tr></table>`;
}

/** E-mail de redefinição de senha. `link` é a URL completa com o token. */
export function emailRedefinicaoSenha(
  nome: string,
  link: string,
): { assunto: string; texto: string; html: string } {
  const assunto = 'Redefinição de senha — Meu Mercado';
  const texto = `Oi, ${nome}!

Recebemos um pedido para redefinir sua senha no Meu Mercado. Abra o link abaixo (vale por 1 hora):

${link}

Se não foi você, pode ignorar este e-mail — sua senha continua a mesma.

— Meu Mercado 🧡`;

  const miolo = `
    <tr><td style="padding:8px 28px 0;">
      <h1 style="margin:0 0 8px;font-size:19px;font-weight:800;color:${TEXT};text-align:center;">Redefinir sua senha</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${SUB};text-align:center;">
        Oi, <b>${esc(nome)}</b>! Recebemos um pedido para redefinir a sua senha. Clique no botão abaixo para criar uma nova.
      </p>
    </td></tr>
    <tr><td style="padding:0 28px 4px;" align="center">${botao('Redefinir minha senha', link)}</td></tr>
    <tr><td style="padding:16px 28px 0;">
      <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">
        O link vale por <b>1 hora</b>. Se o botão não funcionar, copie e cole este endereço no navegador:
      </p>
      <p style="margin:6px 0 0;font-size:12px;line-height:1.5;text-align:center;word-break:break-all;">
        <a href="${link}" style="color:${PRIMARY};text-decoration:none;">${link}</a>
      </p>
    </td></tr>
    <tr><td style="padding:20px 28px 24px;">
      <hr style="border:none;border-top:1px solid ${BORDER};margin:0 0 14px;">
      <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">
        Se não foi você, pode ignorar este e-mail — sua senha continua a mesma.<br>— Meu Mercado 🧡
      </p>
    </td></tr>`;

  return { assunto, texto, html: casca(miolo) };
}
