import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/theme';
import { AppLogo, Btn } from '../../ui/kit';

interface Stats {
  produtos: number;
  precos: number;
  mercados: number;
}

/**
 * Boas-vindas de primeira abertura. Como o banco JÁ está ativo, a tela mostra o
 * valor que existe (a comunidade já economizando) e convida a ativar registrando
 * o 1º preço — o momento que destrava a Nina e alimenta a cobertura.
 */
export function Onboarding({
  onRegistrar,
  onExplorar,
  onFechar,
}: {
  onRegistrar: () => void;
  onExplorar: () => void;
  onFechar: () => void;
}) {
  const { T } = useTheme();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.track('onboarding_visto');
    void Promise.all([api.listarProdutos(), api.mercadosPreco()])
      .then(([produtos, mercados]) =>
        setStats({
          produtos: produtos.length,
          precos: mercados.reduce((s, m) => s + m.count, 0),
          mercados: mercados.length,
        }),
      )
      .catch(() => setStats({ produtos: 0, precos: 0, mercados: 0 }));
  }, []);

  const primeiro = user?.nome?.trim().split(/\s+/)[0] ?? '';
  const temDados = !!stats && stats.precos > 0;

  const numero = (n: number, label: string) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ color: T.primary, fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
        {n.toLocaleString('pt-BR')}
      </div>
      <div style={{ color: T.muted, fontSize: 11, fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <AppLogo size={22} />
        </div>
        <h1
          style={{
            color: T.text,
            fontSize: 24,
            fontWeight: 800,
            textAlign: 'center',
            margin: '16px 0 6px',
          }}
        >
          Bem-vindo{primeiro ? `, ${primeiro}` : ''}! 👋
        </h1>
        <p
          style={{
            color: T.sub,
            fontSize: 14,
            textAlign: 'center',
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          {temDados
            ? 'A comunidade já está economizando de verdade. Veja os preços — e ajude registrando os seus.'
            : 'Registre os preços que você vê nas compras e descubra onde cada item está mais barato.'}
        </p>

        {temDados && (
          <div
            style={{
              display: 'flex',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              padding: '16px 8px',
              marginBottom: 20,
            }}
          >
            {numero(stats!.precos, 'preços')}
            {numero(stats!.produtos, 'produtos')}
            {numero(stats!.mercados, 'mercados')}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            textAlign: 'left',
            marginBottom: 22,
          }}
        >
          {[
            ['🏷️', 'Compare preços colaborativos por mercado'],
            ['📷', 'Registre num toque — manual ou lendo a nota (QR)'],
            ['✨', 'A Nina (Pro) mostra onde economizar na sua cesta'],
          ].map(([emoji, txt]) => (
            <div key={txt} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{emoji}</span>
              <span style={{ color: T.text, fontSize: 14 }}>{txt}</span>
            </div>
          ))}
        </div>

        <Btn
          full
          onClick={() => {
            api.track('onboarding_cta_registrar');
            onRegistrar();
          }}
        >
          ➕ Registrar meu primeiro preço
        </Btn>
        <div style={{ height: 10 }} />
        <Btn
          full
          variant="soft"
          onClick={() => {
            api.track('onboarding_explorar');
            onExplorar();
          }}
        >
          👀 Explorar os preços
        </Btn>
        <button
          onClick={() => {
            api.track('onboarding_dispensado');
            onFechar();
          }}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: T.muted,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '14px 0 0',
          }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
