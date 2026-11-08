"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authedFetch } from "@/lib/adminFetch";
import { formatarMoeda, STATUS_RECEBER_LABELS, STATUS_RECEBER_STYLES } from "@/lib/financeiro";

export default function MeuFinanceiroPage() {
  const { condominio, member } = useAuth();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/condomino/meu-financeiro?condominioId=${condominio.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar seu financeiro.");
      setContas(data.contas || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!condominio) return <p className="text-navy-500">Carregando condomínio...</p>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Meu Financeiro</h1>
        <p className="mt-1 text-sm text-navy-500">
          {member?.unidade ? `Cobranças da unidade ${member.unidade}.` : "Suas cobranças junto ao condomínio."}
        </p>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando...</p>
      ) : contas.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhuma cobrança registrada ainda.</div>
      ) : (
        <div className="space-y-2">
          {contas.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{c.descricao}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_RECEBER_STYLES[c.status]}`}>
                    {STATUS_RECEBER_LABELS[c.status] || c.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-navy-600">{formatarMoeda(c.valor)}</p>
                {c.itens?.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-navy-500">
                    {c.itens.map((item, idx) => (
                      <li key={idx}>
                        {item.descricao}: {formatarMoeda(item.valor)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-navy-400">
                  {c.data_vencimento && `Vencimento: ${new Date(`${c.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}`}
                  {c.data_recebimento && ` · Pago em: ${new Date(`${c.data_recebimento}T00:00:00`).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <div className="flex flex-none flex-col items-end gap-1">
                {c.boleto_url && (
                  <a href={c.boleto_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-navy-700 hover:underline">
                    2ª via do boleto
                  </a>
                )}
                {c.boleto_linha_digitavel && (
                  <button
                    onClick={() => navigator.clipboard?.writeText(c.boleto_linha_digitavel)}
                    className="text-xs font-semibold text-navy-500 hover:underline"
                  >
                    Copiar linha digitável
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
