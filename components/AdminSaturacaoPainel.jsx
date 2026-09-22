"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";

const NIVEL_COR = {
  ok: { barra: "bg-emerald-500", texto: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  atencao: { barra: "bg-amber-500", texto: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  critico: { barra: "bg-coral", texto: "text-coral-700", badge: "bg-coral-100 text-coral-700" },
};

const NIVEL_LABEL = { ok: "Tranquilo", atencao: "Atenção", critico: "Crítico" };

export default function AdminSaturacaoPainel() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await authedFetch("/api/admin/saturacao");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar saturação.");
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
  if (!dados) return <div className="card"><p className="text-sm text-navy-400">Carregando capacidade...</p></div>;

  const cor = NIVEL_COR[dados.nivelGeral];

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">
          Saturação e capacidade
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor.badge}`}>
          {NIVEL_LABEL[dados.nivelGeral]}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-navy-400">Condomínios</p>
          <p className="font-display text-xl font-bold text-navy-900">{dados.totalCondominios}</p>
        </div>
        <div>
          <p className="text-xs text-navy-400">Usuários (moradores + membros)</p>
          <p className="font-display text-xl font-bold text-navy-900">{dados.totalUsuarios}</p>
        </div>
        <div>
          <p className="text-xs text-navy-400">Registros de auditoria</p>
          <p className="font-display text-xl font-bold text-navy-900">{dados.registrosCrescimento.auditoria}</p>
        </div>
        <div>
          <p className="text-xs text-navy-400">Chamados no histórico</p>
          <p className="font-display text-xl font-bold text-navy-900">{dados.registrosCrescimento.chamados}</p>
        </div>
      </div>

      <div className="space-y-4">
        {dados.uso.map((item) => {
          const corItem = NIVEL_COR[item.nivel];
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-navy-700">
                  {item.label}
                  {item.estimativa && (
                    <span className="ml-1.5 rounded-full bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy-400">
                      estimativa
                    </span>
                  )}
                </span>
                <span className={`font-semibold ${corItem.texto}`}>{item.detalheTexto}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-navy-50">
                <div
                  className={`h-2 rounded-full ${corItem.barra}`}
                  style={{ width: `${Math.min(100, item.percentual)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {dados.nivelGeral !== "ok" && (
        <p className="mt-4 text-xs text-navy-500">
          Quando uma barra chega no amarelo/vermelho, é hora de migrar pro plano pago daquele serviço
          específico — não precisa esperar todos ficarem vermelhos ao mesmo tempo.
        </p>
      )}
    </div>
  );
}
