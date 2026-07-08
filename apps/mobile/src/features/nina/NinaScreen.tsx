import { useEffect, useState } from 'react';
import type { InsightDTO } from '@meumercado/contracts';
import { api, formatBRL } from '../../api/client';
import { useTheme } from '../../theme/theme';
import { EmptyState, SLabel } from '../../ui/kit';

export function NinaScreen() {
  const { T } = useTheme();
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

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: T.ninaGrad, padding: '22px 20px', borderRadius: '0 0 28px 28px' }}>
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

      <div style={{ padding: '16px 16px 0' }}>
        <SLabel>Alertas</SLabel>
        {error && <EmptyState emoji="⚠️" titulo="Falha ao carregar" sub={error} />}
        {!error && insights === null && <p style={{ color: T.muted }}>Analisando…</p>}
        {insights?.length === 0 && (
          <EmptyState
            emoji="🔍"
            titulo="Sem alertas por enquanto"
            sub="Registre mais preços para a Nina analisar."
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {insights?.map((ins, i) => (
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
    </div>
  );
}
