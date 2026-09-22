"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { formatarMoeda } from "@/lib/vizinnFinanceiro";

// Destaque no topo do painel admin pro vencimento mais próximo de
// "Domínio" em vizinn_lancamentos (ex: renovação anual do vizinn.com.br
// no registro.br) — alimentado pelo mesmo lançamento que dispara os
// e-mails de lembrete (ver /api/cron/lembretes-financeiro). Some
// sozinho se não houver nenhum lançamento de domínio cadastrado ainda.
function nivelPorDias(dias) {
  if (dias == null) return "ok";
  if (dias <= 15) return "critico";
  if (dias <= 60) return "atencao";
  return "ok";
}

const NIVEL_ESTILO = {
  ok: "border-navy-100 bg-white",
  atencao: "border-amber-300 bg-amber-50",
  critico: "border-coral bg-coral-50",
};

const NIVEL_TEXTO = {
  ok: "text-navy-700",
  atencao: "text-amber-700",
  critico: "text-coral-700",
};

export default function AdminDominioDestaque() {
  const [lancamento, setLancamento] = useState(undefined); // undefined = carregando, null = nenhum

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await authedFetch("/api/admin/lancamentos?tipo=pagar");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        const dominios = (json.lancamentos || [])
          .filter((l) => l.categoria === "Domínio" && l.status === "pendente" && l.data_vencimento)
          .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
        if (ativo) setLancamento(dominios[0] || null);
      } catch {
        if (ativo) setLancamento(null);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (!lancamento) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(`${lancamento.data_vencimento}T00:00:00`);
  const dias = Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));
  const nivel = nivelPorDias(dias);

  return (
    <div className={`card flex flex-wrap items-center justify-between gap-3 border-2 ${NIVEL_ESTILO[nivel]}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Renovação de domínio</p>
        <p className={`mt-1 font-display text-lg font-bold ${NIVEL_TEXTO[nivel]}`}>
          {lancamento.descricao} — {dias < 0 ? `venceu há ${-dias} dia(s)` : dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`}
        </p>
        <p className="text-xs text-navy-400">
          {vencimento.toLocaleDateString("pt-BR")} · {formatarMoeda(lancamento.valor)}
        </p>
      </div>
      <Link href="/admin/financeiro" className="btn-secondary flex-none text-sm">
        Ver no Financeiro
      </Link>
    </div>
  );
}
