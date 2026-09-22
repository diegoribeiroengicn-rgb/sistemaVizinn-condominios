"use client";

import { useMemo } from "react";

// Crescimento acumulado de condomínios cadastrados, mês a mês — a
// partir dos mesmos dados já carregados em /api/admin/overview (sem
// endpoint novo). Cada barra é o total acumulado até o fim daquele mês.
function bucketsUltimosMeses(quantidade) {
  const hoje = new Date();
  const buckets = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    buckets.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, ano: d.getFullYear(), mes: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short" }) });
  }
  return buckets;
}

export default function AdminCrescimentoGrafico({ condominios }) {
  const acumulado = useMemo(() => {
    const buckets = bucketsUltimosMeses(12);
    return buckets.map((b) => {
      const fimDoMes = new Date(b.ano, b.mes + 1, 0, 23, 59, 59);
      const total = (condominios || []).filter((c) => c.created_at && new Date(c.created_at) <= fimDoMes).length;
      return { label: b.label, valor: total };
    });
  }, [condominios]);

  const max = Math.max(1, ...acumulado.map((b) => b.valor));
  const totalAtual = acumulado[acumulado.length - 1]?.valor || 0;
  const totalHaUmAno = acumulado[0]?.valor || 0;
  const crescimento = totalHaUmAno > 0 ? Math.round(((totalAtual - totalHaUmAno) / totalHaUmAno) * 100) : null;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">Crescimento (12 meses)</h2>
        {crescimento != null && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            +{crescimento}% no período
          </span>
        )}
      </div>
      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {acumulado.map((b) => (
          <div key={b.label} className="group relative flex flex-1 flex-col items-center gap-1" title={`${b.label}: ${b.valor} condomínio(s)`}>
            <span className="text-xs font-semibold text-navy-700">{b.valor}</span>
            <div className="w-full rounded-t-md bg-midnight transition group-hover:bg-coral" style={{ height: Math.max(4, (b.valor / max) * 90) }} />
            <span className="text-[10px] text-navy-400">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
