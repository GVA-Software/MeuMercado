import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdminStatsDTO, AdminUserDTO } from '@meumercado/contracts';
import { api } from '../../api/client';
import { useTheme, type Theme } from '../../theme/theme';
import { CartLoader, EmptyState } from '../../ui/kit';

function dataLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

/** Painel de administração: cadastros, assinaturas e gestão de usuários. */
export function AdminScreen({ onClose }: { onClose: () => void }) {
  const { T }: { T: Theme } = useTheme();
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [users, setUsers] = useState<AdminUserDTO[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [agindo, setAgindo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([api.adminStats(), api.adminUsuarios()]);
      setStats(s);
      setUsers(u.items);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function aplicar(atualizado: AdminUserDTO) {
    setUsers((prev) => (prev ? prev.map((u) => (u.id === atualizado.id ? atualizado : u)) : prev));
    void api.adminStats().then(setStats).catch(() => {});
  }

  async function acao(id: string, fn: () => Promise<AdminUserDTO>) {
    setAgindo(id);
    setErro(null);
    try {
      aplicar(await fn());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setAgindo(null);
    }
  }

  async function excluir(u: AdminUserDTO) {
    if (!window.confirm(`Excluir ${u.nome} (${u.email})? Esta ação não pode ser desfeita.`)) return;
    setAgindo(u.id);
    setErro(null);
    try {
      await api.adminExcluir(u.id);
      setUsers((prev) => (prev ? prev.filter((x) => x.id !== u.id) : prev));
      void api.adminStats().then(setStats).catch(() => {});
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setAgindo(null);
    }
  }

  const filtrados = useMemo(() => {
    if (!users) return null;
    const t = busca.trim().toLowerCase();
    return t
      ? users.filter((u) => u.nome.toLowerCase().includes(t) || u.email.toLowerCase().includes(t))
      : users;
  }, [users, busca]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: 'calc(16px + env(safe-area-inset-top)) 16px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Voltar"
          style={{ background: 'none', border: 'none', color: T.text, fontSize: 22, cursor: 'pointer', padding: 0 }}
        >
          ‹
        </button>
        <div>
          <p style={{ color: T.text, fontSize: 18, fontWeight: 800, margin: 0 }}>
            🛠️ Administração
          </p>
          <p style={{ color: T.muted, fontSize: 12, margin: '2px 0 0' }}>Cadastros e assinaturas</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 40 }}>
        {erro && (
          <div
            style={{
              background: `${T.danger}18`,
              border: `1px solid ${T.danger}55`,
              borderRadius: 12,
              padding: '10px 12px',
              marginBottom: 14,
              color: T.danger,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {erro}
          </div>
        )}

        {!stats && !erro && <CartLoader label="Carregando o painel…" center />}

        {stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <StatCard label="Usuários" valor={stats.totalUsuarios} cor={T.primary} T={T} />
              <StatCard label="Pro ativos" valor={stats.proAtivos} cor={T.green} T={T} />
              <StatCard label="Em teste" valor={stats.trials} cor={T.nina} T={T} />
              <StatCard label="Free" valor={stats.free} cor={T.muted} T={T} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: '12px 8px',
                marginBottom: 18,
              }}
            >
              <MiniStat label="hoje" valor={stats.cadastrosHoje} T={T} />
              <MiniStat label="7 dias" valor={stats.cadastros7d} T={T} />
              <MiniStat label="30 dias" valor={stats.cadastros30d} T={T} />
              <MiniStat label="admins" valor={stats.admins} T={T} />
            </div>

            <input
              placeholder="Buscar por nome ou e-mail…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: `1.5px solid ${T.border}`,
                borderRadius: 12,
                padding: '11px 14px',
                background: T.card,
                color: T.text,
                fontSize: 15,
                marginBottom: 12,
              }}
            />
          </>
        )}

        {filtrados && filtrados.length === 0 && (
          <EmptyState emoji="🔍" titulo="Nenhum usuário" sub="Ajuste a busca acima." />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados?.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              T={T}
              aberto={aberto === u.id}
              agindo={agindo === u.id}
              onToggle={() => setAberto((a) => (a === u.id ? null : u.id))}
              onTrial={() => void acao(u.id, () => api.adminConcederTrial(u.id))}
              onProMensal={() => void acao(u.id, () => api.adminConcederPro(u.id, 'mensal'))}
              onProAnual={() => void acao(u.id, () => api.adminConcederPro(u.id, 'anual'))}
              onRevogar={() => void acao(u.id, () => api.adminRevogar(u.id))}
              onExcluir={() => void excluir(u)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatCard({ label, valor, cor, T }: { label: string; valor: number; cor: string; T: Theme }) {
  return (
    <div
      style={{
        background: `${cor}14`,
        border: `1px solid ${cor}40`,
        borderRadius: 16,
        padding: '14px 16px',
      }}
    >
      <p style={{ color: cor, fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1 }}>{valor}</p>
      <p style={{ color: T.sub, fontSize: 12, fontWeight: 700, margin: '6px 0 0' }}>{label}</p>
    </div>
  );
}

function MiniStat({ label, valor, T }: { label: string; valor: number; T: Theme }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: T.text, fontSize: 17, fontWeight: 800, margin: 0 }}>{valor}</p>
      <p style={{ color: T.muted, fontSize: 11, margin: '2px 0 0' }}>{label}</p>
    </div>
  );
}

function PlanoChip({ u, T }: { u: AdminUserDTO; T: Theme }) {
  let cor = T.muted;
  let label = 'FREE';
  if (u.isPro && u.status === 'trial') {
    cor = T.nina;
    label = `TESTE · ${u.diasRestantes}d`;
  } else if (u.isPro) {
    cor = T.green;
    label = `PRO · ${u.status}`;
  }
  return (
    <span
      style={{
        background: `${cor}20`,
        color: cor,
        fontSize: 10,
        fontWeight: 800,
        padding: '3px 8px',
        borderRadius: 99,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function UserCard({
  u,
  T,
  aberto,
  agindo,
  onToggle,
  onTrial,
  onProMensal,
  onProAnual,
  onRevogar,
  onExcluir,
}: {
  u: AdminUserDTO;
  T: Theme;
  aberto: boolean;
  agindo: boolean;
  onToggle: () => void;
  onTrial: () => void;
  onProMensal: () => void;
  onProAnual: () => void;
  onRevogar: () => void;
  onExcluir: () => void;
}) {
  const inicial = (u.nome.trim()[0] ?? '?').toUpperCase();
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '12px 14px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: T.primaryBg,
            color: T.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {inicial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p
              style={{
                color: T.text,
                fontSize: 14,
                fontWeight: 700,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {u.nome}
            </p>
            {u.isAdmin && (
              <span
                style={{
                  background: `${T.primary}22`,
                  color: T.primary,
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 99,
                }}
              >
                ADMIN
              </span>
            )}
          </div>
          <p
            style={{
              color: T.muted,
              fontSize: 12,
              margin: '2px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {u.email}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <PlanoChip u={u} T={T} />
          <span style={{ color: T.muted, fontSize: 10 }}>{dataLabel(u.criadoEm)}</span>
        </div>
      </button>

      {aberto && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <AcaoBtn label="🎁 Teste Nina (7d)" onClick={onTrial} disabled={agindo} T={T} />
          <AcaoBtn label="Pro mensal" onClick={onProMensal} disabled={agindo} T={T} />
          <AcaoBtn label="Pro anual" onClick={onProAnual} disabled={agindo} T={T} />
          {u.isPro && <AcaoBtn label="Revogar" onClick={onRevogar} disabled={agindo} T={T} />}
          {!u.isAdmin && (
            <AcaoBtn label="🗑️ Excluir" onClick={onExcluir} disabled={agindo} T={T} perigo />
          )}
        </div>
      )}
    </div>
  );
}

function AcaoBtn({
  label,
  onClick,
  disabled,
  perigo,
  T,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  perigo?: boolean;
  T: Theme;
}) {
  const cor = perigo ? T.danger : T.primary;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: `${cor}14`,
        color: cor,
        border: `1px solid ${cor}44`,
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
