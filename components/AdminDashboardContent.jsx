"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { PLANS, getPlan } from "@/lib/plans";
import AdminManageModal from "@/components/AdminManageModal";
import AdminSaturacaoPainel from "@/components/AdminSaturacaoPainel";
import AdminFaturamentoPainel from "@/components/AdminFaturamentoPainel";
import AdminCrescimentoGrafico from "@/components/AdminCrescimentoGrafico";
import AdminDominioDestaque from "@/components/AdminDominioDestaque";

const STATUS_LABELS = {
  active: "Ativo",
  trialing: "Em teste",
  canceled: "Cancelado",
  past_due: "Pagamento pendente",
  unpaid: "Inadimplente",
  incomplete: "Incompleto",
  incomplete_expired: "Expirado",
  suspended: "Suspenso",
  promessa: "Promessa de pagamento",
  cortesia: "Cortesia",
};

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-amber-100 text-amber-700",
  canceled: "bg-navy-100 text-navy-500",
  past_due: "bg-coral-100 text-coral-700",
  unpaid: "bg-coral-100 text-coral-700",
  suspended: "bg-coral-100 text-coral-700",
  promessa: "bg-sky-100 text-sky-700",
  cortesia: "bg-violet-100 text-violet-700",
};

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );
}

export default function AdminDashboardContent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/overview");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar dados.");
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-navy-500">Carregando painel administrativo...</p>;
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-coral-700">{error}</p>
        <button onClick={load} className="btn-secondary mt-4">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  const days = Object.keys(data.signupsByDay).sort().slice(-14);
  const maxSignups = Math.max(1, ...days.map((d) => data.signupsByDay[d]));

  const kpis = [
    { label: "Condomínios", value: data.totalCondominios },
    { label: "MRR (pagantes)", value: formatBRL(data.mrr) },
    { label: "MRR projetado", value: formatBRL(data.projectedMrr) },
    { label: "Em teste", value: data.trialCount },
    { label: "Suspensos", value: data.suspendedCount },
    { label: "Promessa de pagamento", value: data.promiseCount },
    { label: "Cortesias", value: data.courtesyCount },
    { label: "Cancelados", value: data.canceledCount },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">
          Painel do administrador
        </h1>
        <p className="text-navy-500">
          Visão geral de todos os condomínios cadastrados na Vizinn.
        </p>
      </div>

      <AdminDominioDestaque />

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card">
            <p className="text-xs text-navy-400">{kpi.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-navy-900">{kpi.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-400">
            Distribuição por plano
          </h2>
          <div className="space-y-3">
            {PLANS.map((plan) => {
              const count = data.planCounts[plan.id] || 0;
              const pct = data.totalCondominios
                ? Math.round((count / data.totalCondominios) * 100)
                : 0;
              return (
                <div key={plan.id}>
                  <div className="flex justify-between text-sm text-navy-700">
                    <span>{plan.name}</span>
                    <span>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-navy-50">
                    <div
                      className="h-2 rounded-full bg-coral"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-navy-400">
            {data.totalUnidadesAtivas}/{data.totalUnidadesLimite} unidades ativas no total
          </p>
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-400">
            Cadastros (últimos 14 dias com dados)
          </h2>
          {days.length === 0 ? (
            <p className="text-sm text-navy-400">Sem cadastros ainda.</p>
          ) : (
            <div className="flex h-32 items-end gap-1">
              {days.map((d) => (
                <div
                  key={d}
                  className="group relative flex-1"
                  title={`${d}: ${data.signupsByDay[d]} cadastro(s)`}
                >
                  <div
                    className="rounded-t bg-midnight transition group-hover:bg-coral"
                    style={{
                      height: `${Math.max(6, (data.signupsByDay[d] / maxSignups) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminFaturamentoPainel />
        <AdminCrescimentoGrafico condominios={data.condominios} />
      </section>

      <section>
        <AdminSaturacaoPainel />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">
            Condomínios ({data.totalCondominios})
          </h2>
          <button onClick={load} className="btn-ghost text-sm">
            Atualizar
          </button>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/50 text-left text-navy-500">
              <tr>
                <th className="px-4 py-3 font-medium">Condomínio</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Unidades</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.condominios.map((c) => (
                <tr key={c.id} className="border-b border-navy-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-navy-900">{c.nome}</td>
                  <td className="px-4 py-3 text-navy-600">
                    {c.responsavel_nome || "-"}
                    <br />
                    <span className="text-xs text-navy-400">{c.owner_email}</span>
                  </td>
                  <td className="px-4 py-3 text-navy-600">{getPlan(c.plano).name}</td>
                  <td className="px-4 py-3 text-navy-600">
                    {c.unidades_ativas ?? 0}/{c.unidades_limite}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[c.status] || "bg-navy-100 text-navy-500"
                      }`}
                    >
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setManaging(c)}
                      className="text-xs font-semibold text-coral hover:underline"
                    >
                      Gerenciar
                    </button>
                  </td>
                </tr>
              ))}
              {data.condominios.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy-400">
                    Nenhum condomínio cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {managing && (
        <AdminManageModal
          condominio={managing}
          onClose={() => setManaging(null)}
          onChanged={async () => {
            setManaging(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
