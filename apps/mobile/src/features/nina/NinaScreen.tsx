import { useEffect, useState } from 'react';
import { PLANOS, type InsightDTO, type Periodo } from '@meumercado/contracts';
import { api, formatBRL } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useTheme, type Theme } from '../../theme/theme';
import { CartLoader, EmptyState, SLabel } from '../../ui/kit';

const BENEFICIOS = [
  '✨ Insights automáticos dos seus preços',
  '📉 Alertas de alta e queda',
  '🏷️ Onde cada item está mais barato',
  '🛒 Melhor combinação de mercados pra sua cesta',
  '📊 Histórico e economia acumulada',
];

export function NinaScreen() {
  const { T } = useTheme();
  const { subscription } = useAuth();
  const isPro = subscription?.isPro ?? false;

  return (
    <div style={{ paddingBottom: 100 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: T.ninaGrad,
          padding: '22px 20px',
          borderRadius: '0 0 28px 28px',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            ✨
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: '0 0 2px' }}>
              Sua assistente
            </p>
            <p style={{ color: '#FFF', fontSize: 22, fontWeight: 800, margin: 0 }}>Nina IA</p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: 0 }}>
              Análise estatística dos seus preços
            </p>
          </div>
        </div>
      </div>

      {subscription === null ? (
        <div style={{ padding: '16px' }}>
          <CartLoader label="Carregando…" />
        </div>
      ) : isPro ? (
        <NinaInsights T={T} />
      ) : (
        <NinaBloqueada T={T} />
      )}
    </div>
  );
}

/** Nina liberada (Pro): mostra os insights reais. */
function NinaInsights({ T }: { T: Theme }) {
  const [insights, setInsights] = useState<InsightDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.insights();
        setInsights(r.insights);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  // Empurrãozinho: o card de maior impacto vira destaque no topo. Preferimos uma
  // economia concreta (tem `economia`); na falta, o coach proativo ('oportunidade').
  const lead =
    insights?.find((i) => i.economia) ?? insights?.find((i) => i.type === 'oportunidade') ?? null;
  const rest = insights?.filter((i) => i !== lead) ?? [];

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {error && <EmptyState emoji="⚠️" titulo="Falha ao carregar" sub={error} />}
      {!error && insights === null && <CartLoader label="Analisando seus preços…" />}
      {insights?.length === 0 && (
        <EmptyState
          emoji="✨"
          titulo="Coletando dados"
          sub="Registre preços (manual, QR da nota ou no carrinho). Assim que houver o que comparar, a Nina traz os alertas aqui."
        />
      )}
      {lead && <NinaLead T={T} ins={lead} />}
      {rest.length > 0 && <SLabel>Alertas</SLabel>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rest.map((ins, i) => (
          <div
            key={i}
            style={{
              background: T.surface,
              borderRadius: 16,
              padding: 16,
              border: `1px solid ${ins.urgente ? `${T.nina}66` : T.border}`,
              boxShadow: `0 1px 4px ${T.shadow}`,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: ins.urgente ? T.ninaBg : T.card,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              {ins.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <p style={{ color: T.text, fontSize: 14, fontWeight: 700, margin: 0 }}>
                  {ins.titulo}
                </p>
                {ins.urgente && (
                  <span
                    style={{
                      background: T.danger,
                      color: '#FFF',
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 99,
                    }}
                  >
                    URGENTE
                  </span>
                )}
              </div>
              <p style={{ color: T.sub, fontSize: 13, margin: 0, lineHeight: 1.5 }}>{ins.sub}</p>
              {ins.economia && (
                <p style={{ color: T.green, fontSize: 13, fontWeight: 700, margin: '6px 0 0' }}>
                  💰 Economia: {formatBRL(ins.economia.cents)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Destaque proativo no topo da Nina — o "empurrãozinho" de maior impacto. */
function NinaLead({ T, ins }: { T: Theme; ins: InsightDTO }) {
  return (
    <div
      style={{
        background: T.ninaGrad,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        color: '#FFF',
        boxShadow: `0 6px 20px ${T.shadow}`,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.5,
          background: 'rgba(255,255,255,0.2)',
          padding: '3px 8px',
          borderRadius: 99,
          marginBottom: 10,
        }}
      >
        ✨ EMPURRÃOZINHO
      </span>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            flexShrink: 0,
          }}
        >
          {ins.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>{ins.titulo}</p>
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, color: 'rgba(255,255,255,0.9)' }}>
            {ins.sub}
          </p>
          {ins.economia && (
            <p style={{ fontSize: 14, fontWeight: 800, margin: '8px 0 0' }}>
              💰 Economize {formatBRL(ins.economia.cents)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Nina bloqueada (Free): tela de desbloqueio com benefícios e preços. */
function NinaBloqueada({ T }: { T: Theme }) {
  return (
    <div style={{ padding: '20px 16px' }}>
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: '24px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }}>🔒</div>
        <p style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>
          A Nina IA é um recurso Pro
        </p>
        <p style={{ color: T.muted, fontSize: 13, margin: '0 0 18px', lineHeight: 1.5 }}>
          Assine para desbloquear os insights inteligentes dos seus preços.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            textAlign: 'left',
            marginBottom: 20,
          }}
        >
          {BENEFICIOS.map((b) => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: T.green, fontSize: 15 }}>✓</span>
              <span style={{ color: T.text, fontSize: 14 }}>{b}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {(['mensal', 'anual'] as Periodo[]).map((p) => (
            <div
              key={p}
              style={{
                flex: 1,
                border: `1.5px solid ${p === 'anual' ? T.nina : T.border}`,
                background: p === 'anual' ? `${T.nina}14` : T.card,
                borderRadius: 16,
                padding: '14px 10px',
              }}
            >
              <p
                style={{
                  color: T.muted,
                  fontSize: 12,
                  fontWeight: 700,
                  margin: '0 0 4px',
                  textTransform: 'capitalize',
                }}
              >
                {p}
                {p === 'anual' ? ' · melhor valor' : ''}
              </p>
              <p style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: 0 }}>
                {PLANOS[p].label}
              </p>
            </div>
          ))}
        </div>

        <p style={{ color: T.muted, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          🛠️ A ativação é feita pela administração do Meu Mercado. Fale com a gente para liberar o
          seu Pro.
        </p>
      </div>
    </div>
  );
}
