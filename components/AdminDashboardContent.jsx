"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { PLANS } from "@/lib/plans";
import AdminSaturacaoPainel from "@/components/AdminSaturacaoPainel";
import AdminFaturamentoPainel from "@/components/AdminFaturamentoPainel";
import AdminCrescimentoGrafico from "@/components/AdminCrescimentoGrafico";
import AdminDominioDestaque from "@/components/AdminDominioDestaque";

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );
}

export default function AdminDashboardContent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
    </div>
  );
}
