import { describe, it, expect } from 'vitest';
import { emailRedefinicaoSenha } from './templates.js';

describe('emailRedefinicaoSenha', () => {
  const link = 'https://meumercado-prod.onrender.com/?reset=abc-123_XYZ';

  it('assunto + texto + html com o link e o nome', () => {
    const { assunto, texto, html } = emailRedefinicaoSenha('Ana', link);
    expect(assunto).toMatch(/senha/i);
    // Texto puro (fallback) tem o link e o nome.
    expect(texto).toContain(link);
    expect(texto).toContain('Ana');
    // HTML tem o botão (href = link) e o link visível de fallback.
    expect(html).toContain(`href="${link}"`);
    expect(html).toContain('Redefinir minha senha');
    expect(html).toContain('Meu Mercado');
  });

  it('escapa o nome do usuário (não injeta HTML)', () => {
    const { html } = emailRedefinicaoSenha('<script>x</script>', link);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
