import { afterEach, describe, expect, it, vi } from 'vitest';
import { GmailEmailService } from './email.service.js';

/** Resposta fake de `fetch` só com o necessário (ok/status/json/text). */
function resp(ok: boolean, body: unknown, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function make() {
  return new GmailEmailService(
    'cid',
    'csecret',
    'refresh-tok',
    'gvasoftware7@gmail.com',
    'Meu Mercado',
  );
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/** Decodifica o `raw` (base64url) do corpo enviado ao Gmail para inspeção. */
function rawEnviado(fetchMock: ReturnType<typeof vi.fn>): string {
  const call = fetchMock.mock.calls.find(([url]) => url === SEND_URL);
  const body = JSON.parse((call![1] as { body: string }).body) as { raw: string };
  return Buffer.from(body.raw, 'base64url').toString('utf8');
}

afterEach(() => vi.restoreAllMocks());

describe('GmailEmailService', () => {
  it('troca refresh token por access token e envia (Authorization Bearer + raw MIME)', async () => {
    const fetchMock = vi.fn(
      (url: string, _opts?: { body?: unknown; headers?: Record<string, string> }) =>
        Promise.resolve(
          url === TOKEN_URL
            ? resp(true, { access_token: 'ya29.abc', expires_in: 3600 })
            : resp(true, { id: 'msg1' }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await make().enviar(
      'destino@icloud.com',
      'Redefinição de senha — Meu Mercado',
      'Oi, Gustavo!\nlink',
    );

    // Chamou o endpoint de token com grant_type=refresh_token.
    const tokenCall = fetchMock.mock.calls.find(([u]) => u === TOKEN_URL)!;
    expect(String((tokenCall[1] as { body: URLSearchParams }).body)).toContain(
      'grant_type=refresh_token',
    );
    // Enviou com Bearer do access token.
    const sendCall = fetchMock.mock.calls.find(([u]) => u === SEND_URL)!;
    expect((sendCall[1] as { headers: Record<string, string> }).headers.authorization).toBe(
      'Bearer ya29.abc',
    );
    // A mensagem RFC 822 traz remetente, destinatário e o assunto acentuado (encoded-word).
    const raw = rawEnviado(fetchMock);
    expect(raw).toContain('From: Meu Mercado <gvasoftware7@gmail.com>');
    expect(raw).toContain('To: destino@icloud.com');
    expect(raw).toContain(
      `=?UTF-8?B?${Buffer.from('Redefinição de senha — Meu Mercado', 'utf8').toString('base64')}?=`,
    );
    // O corpo (base64) decodifica no texto original.
    const corpoB64 = raw.split('\r\n\r\n')[1]!.replace(/\r\n/g, '');
    expect(Buffer.from(corpoB64, 'base64').toString('utf8')).toBe('Oi, Gustavo!\nlink');
  });

  it('cacheia o access token: 2 envios = 1 troca de token', async () => {
    const fetchMock = vi.fn(
      (url: string, _opts?: { body?: unknown; headers?: Record<string, string> }) =>
        Promise.resolve(
          url === TOKEN_URL
            ? resp(true, { access_token: 'ya29.abc', expires_in: 3600 })
            : resp(true, { id: 'm' }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const svc = make();
    await svc.enviar('a@b.com', 'x', 'y');
    await svc.enviar('c@d.com', 'x', 'y');

    expect(fetchMock.mock.calls.filter(([u]) => u === TOKEN_URL).length).toBe(1);
    expect(fetchMock.mock.calls.filter(([u]) => u === SEND_URL).length).toBe(2);
  });

  it('enviarTeste LANÇA quando o Gmail recusa (config errada)', async () => {
    const fetchMock = vi.fn(
      (url: string, _opts?: { body?: unknown; headers?: Record<string, string> }) =>
        Promise.resolve(
          url === TOKEN_URL
            ? resp(true, { access_token: 't', expires_in: 3600 })
            : resp(false, 'forbidden', 403),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(make().enviarTeste('a@b.com')).rejects.toThrow(/Gmail 403/);
  });

  it('enviar é best-effort: não lança se o token falha', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(resp(false, 'invalid_grant', 400)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(make().enviar('a@b.com', 'x', 'y')).resolves.toBeUndefined();
  });

  it('com HTML: envia multipart/alternative (texto + HTML), ambos decodificam', async () => {
    const fetchMock = vi.fn(
      (url: string, _opts?: { body?: unknown; headers?: Record<string, string> }) =>
        Promise.resolve(
          url === TOKEN_URL
            ? resp(true, { access_token: 't', expires_in: 3600 })
            : resp(true, { id: 'm' }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await make().enviar('a@b.com', 'Assunto', 'texto puro', '<b>olá</b>');

    const raw = rawEnviado(fetchMock);
    expect(raw).toContain('Content-Type: multipart/alternative; boundary="----=_MeuMercado_alt"');
    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(raw).toContain('Content-Type: text/html; charset="UTF-8"');
    // As duas partes (base64) decodificam no conteúdo original.
    const partes = raw.split('------=_MeuMercado_alt');
    const decodifica = (p: string) =>
      Buffer.from(p.split('\r\n\r\n')[1]!.replace(/\r\n/g, ''), 'base64').toString('utf8');
    expect(decodifica(partes[1]!)).toBe('texto puro');
    expect(decodifica(partes[2]!)).toBe('<b>olá</b>');
  });
});
