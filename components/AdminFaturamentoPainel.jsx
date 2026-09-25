"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import ValorPrivado, { BotaoAlternarValores } from "@/components/ValorPrivado";

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export default function AdminFaturamentoPainel() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await authedFetch("/api/admin/faturamento");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar faturamento.");
        if (ativo) setDados(json);
      } catch (err) {
        if (ativo) setErro(err.message);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) return <div className="card"><p className="text-sm text-coral-700">{erro}</p></div>;
  if (!dados) return <div className="card"><p className="text-sm text-navy-400">Carregando faturamento...</p></div>;

  if (dados.stripeConfigurado === false) {
    return (
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-navy-400">Faturamento</h2>
        <p className="text-sm text-navy-400">Stripe não configurado — sem dados de faturamento real ainda.</p>
      </div>
    );
  }

  const max = Math.max(1, ...dados.ultimos12Meses.map((b) => b.valor));

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">Faturamento (Stripe)</h2>
        <BotaoAlternarValores />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-navy-400">Este mês</p>
          <p className="font-display text-2xl font-bold text-navy-900"><ValorPrivado valor={formatBRL(dados.faturamentoMesAtual)} /></p>
        </div>
        <div>
          <p className="text-xs text-navy-400">Acumulado no ano ({dados.anoAtual})</p>
          <p className="font-display text-2xl font-bold text-navy-900"><ValorPrivado valor={formatBRL(dados.faturamentoYTD)} /></p>
        </div>
      </div>

      <p className="mb-2 text-xs text-navy-400">Últimos 12 meses</p>
      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {dados.ultimos12Meses.map((b) => (
          <div key={b.chave} className="group relative flex flex-1 flex-col items-center gap-1" title={`${b.label}: ${formatBRL(b.valor)}`}>
            <div
              className="w-full rounded-t-md bg-coral transition group-hover:bg-midnight"
              style={{ height: Math.max(4, (b.valor / max) * 90) }}
            />
            <span className="text-[10px] text-navy-400">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
