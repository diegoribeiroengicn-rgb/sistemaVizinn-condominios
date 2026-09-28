"use client";

import { useCallback, useEffect, useState } from "react";
import { vendedorFetch } from "@/lib/vendedorFetch";
import { PLANS } from "@/lib/plans";
import { STATUS_SOLICITACAO_LABELS, STATUS_SOLICITACAO_STYLES } from "@/lib/tetoAdesao";

function formatBRL(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mostra o teto de adesão de cada plano (o máximo que dá pra cobrar
// ao fechar venda por fora — ver enforcement em
// /api/vendedor/cadastrar-condominio e /api/vendedor/link-pagamento)
// e deixa pedir aumento quando precisar cobrar mais que isso.
export default function VendedorTetoAdesao() {
  const [taxas, setTaxas] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pedindoPlanoId, setPedindoPlanoId] = useState(null);
  const [valorPedido, setValorPedido] = useState("");
  const [motivoPedido, setMotivoPedido] = useState("");
  const [enviando, setEnviando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await vendedorFetch("/api/vendedor/taxas-adesao");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar teto de adesão.");
      setTaxas(json.taxas);
      setSolicitacoes(json.solicitacoes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function abrirPedido(planoId, tetoAtual) {
    setPedindoPlanoId(planoId);
    setValorPedido(tetoAtual ? String(tetoAtual) : "");
    setMotivoPedido("");
    setError("");
  }

  async function enviarPedido(planoId) {
    setEnviando(true);
    setError("");
    try {
      const res = await vendedorFetch("/api/vendedor/solicitar-aumento-teto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planoId, valorSolicitado: valorPedido, motivo: motivoPedido }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao enviar pedido.");
      setPedindoPlanoId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const pendentePorPlano = {};
  for (const s of solicitacoes) {
    if (s.status === "pendente") pendentePorPlano[s.plano_id] = s;
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-navy-800">Teto de adesão</h2>
        <p className="mt-1 text-xs text-navy-500">
          O máximo que você pode cobrar de taxa de adesão ao fechar venda por fora, por plano. Acima disso, peça
          aumento aqui.
        </p>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-navy-500">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {taxas.map((t) => {
            const plano = PLANS.find((p) => p.id === t.planoId);
            const pendente = pendentePorPlano[t.planoId];
            return (
              <div key={t.planoId} className="rounded-xl border border-navy-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{plano?.name || t.planoId}</p>
                    <p className="text-xs text-navy-400">Teto atual: {formatBRL(t.teto)}</p>
                  </div>
                  {pendente ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_SOLICITACAO_STYLES.pendente}`}>
                      Pedido de {formatBRL(pendente.valor_solicitado)} pendente
                    </span>
                  ) : pedindoPlanoId === t.planoId ? null : (
                    <button
                      onClick={() => abrirPedido(t.planoId, t.teto)}
                      className="text-xs font-semibold text-coral hover:underline"
                    >
                      Pedir aumento
                    </button>
                  )}
                </div>

                {pedindoPlanoId === t.planoId && (
                  <div className="mt-3 space-y-2 border-t border-navy-50 pt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-navy-500">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-field w-28 text-sm"
                        value={valorPedido}
                        onChange={(e) => setValorPedido(e.target.value)}
                        placeholder="Novo teto"
                      />
                    </div>
                    <input
                      className="input-field w-full text-sm"
                      placeholder="Motivo (opcional)"
                      value={motivoPedido}
                      onChange={(e) => setMotivoPedido(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => enviarPedido(t.planoId)}
                        disabled={enviando}
                        className="btn-primary text-xs disabled:opacity-50"
                      >
                        {enviando ? "Enviando..." : "Enviar pedido"}
                      </button>
                      <button onClick={() => setPedindoPlanoId(null)} className="btn-secondary text-xs">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {solicitacoes.some((s) => s.status !== "pendente") && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-navy-500">Meus pedidos anteriores</summary>
          <div className="mt-2 space-y-1">
            {solicitacoes
              .filter((s) => s.status !== "pendente")
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-navy-50 py-1 last:border-0">
                  <span className="text-navy-600">
                    {PLANS.find((p) => p.id === s.plano_id)?.name || s.plano_id} — {formatBRL(s.valor_solicitado)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_SOLICITACAO_STYLES[s.status]}`}>
                    {STATUS_SOLICITACAO_LABELS[s.status]}
                  </span>
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
