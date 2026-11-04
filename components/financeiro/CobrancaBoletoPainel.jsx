"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { formatarMoeda } from "@/lib/financeiro";

// Card no topo de Contas a Receber: ativa a subconta Asaas do
// condomínio (uma vez só) e, depois de ativa, mostra o saldo disponível
// com um botão de sacar. "Sacar" só aparece pro síndico (owner) — ver
// requireCondominioOwner em /api/financeiro/saque.
export default function CobrancaBoletoPainel({ condominioId, isOwner, onError }) {
  const [status, setStatus] = useState(null); // null = carregando
  const [ativando, setAtivando] = useState(false);
  const [sacando, setSacando] = useState(false);
  const [valorSaque, setValorSaque] = useState("");
  const [pixSaque, setPixSaque] = useState("");
  const [mostrarSaque, setMostrarSaque] = useState(false);

  async function carregarStatus() {
    try {
      const res = await authedFetch(`/api/financeiro/asaas-subconta?condominioId=${condominioId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao consultar status do boleto.");
      setStatus(data);
    } catch (err) {
      onError?.(err.message);
      setStatus({ ativo: false });
    }
  }

  useEffect(() => {
    if (condominioId) carregarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId]);

  async function handleAtivar() {
    setAtivando(true);
    onError?.("");
    try {
      const res = await authedFetch("/api/financeiro/asaas-subconta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condominioId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao ativar cobrança via boleto.");
      await carregarStatus();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setAtivando(false);
    }
  }

  async function handleSacar(e) {
    e.preventDefault();
    if (!valorSaque || !pixSaque.trim()) return;
    setSacando(true);
    onError?.("");
    try {
      const res = await authedFetch("/api/financeiro/saque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condominioId, valor: Number(valorSaque), pixAddressKey: pixSaque.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao solicitar o saque.");
      setValorSaque("");
      setPixSaque("");
      setMostrarSaque(false);
      await carregarStatus();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setSacando(false);
    }
  }

  if (status === null) return null;

  if (!status.ativo) {
    return (
      <div className="card border-2 border-coral-200 bg-coral-50/40">
        <h2 className="font-display text-lg font-bold text-navy-900">Cobrança via boleto</h2>
        <p className="mt-1 text-sm text-navy-600">
          Ative pra emitir boleto de verdade (linha digitável, pago pelo morador) direto nas contas a
          receber abaixo. O dinheiro cai numa subconta própria deste condomínio — nunca na conta da
          AquiHabitto.
        </p>
        <button onClick={handleAtivar} disabled={ativando} className="btn-primary mt-3 disabled:opacity-60">
          {ativando ? "Ativando..." : "Ativar cobrança via boleto"}
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-navy-900">Cobrança via boleto</h2>
          <p className="text-xs text-navy-500">Ativa — emita boleto em qualquer conta a receber abaixo.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-navy-500">Saldo disponível</p>
          <p className="text-lg font-bold text-emerald-700">
            {status.saldo != null ? formatarMoeda(status.saldo) : "—"}
          </p>
        </div>
      </div>

      {isOwner && (
        <div className="mt-3 border-t border-navy-100 pt-3">
          {!mostrarSaque ? (
            <button onClick={() => setMostrarSaque(true)} className="text-sm font-semibold text-navy-700 hover:underline">
              Sacar pra minha conta
            </button>
          ) : (
            <form onSubmit={handleSacar} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label-field">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field w-32"
                  value={valorSaque}
                  onChange={(e) => setValorSaque(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-field">Sua chave PIX</label>
                <input className="input-field" value={pixSaque} onChange={(e) => setPixSaque(e.target.value)} required />
              </div>
              <button type="submit" disabled={sacando} className="btn-primary disabled:opacity-60">
                {sacando ? "Enviando..." : "Confirmar saque"}
              </button>
              <button type="button" onClick={() => setMostrarSaque(false)} className="text-sm text-navy-400 hover:underline">
                Cancelar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
