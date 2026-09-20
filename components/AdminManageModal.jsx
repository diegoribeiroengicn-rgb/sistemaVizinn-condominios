"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { getPlan } from "@/lib/plans";

export default function AdminManageModal({ condominio, onClose, onChanged }) {
  const [note, setNote] = useState(condominio.access_note || "");
  const [courtesyUntil, setCourtesyUntil] = useState(condominio.courtesy_until || "");
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState("");

  const plan = getPlan(condominio.plano);
  const isSuspended = condominio.status === "suspended";
  const isCanceled = condominio.status === "canceled";

  async function run(action, path, extraBody) {
    setBusyAction(action);
    setError("");
    try {
      const res = await authedFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominio.id,
          subscriptionId: condominio.stripe_subscription_id,
          note,
          ...extraBody,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao executar ação.");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction(null);
    }
  }

  function handleCancel() {
    if (!confirm(`Cancelar a assinatura de "${condominio.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    run("cancel", "/api/admin/cancel-subscription");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 px-4 py-8 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-navy-900">{condominio.nome}</h2>
            <p className="text-sm text-navy-500">
              {plan.name} · {condominio.owner_email} · status atual:{" "}
              <strong>{condominio.status}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="label-field">Observação (opcional)</label>
          <textarea
            className="input-field"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Ex: "Promessa de pagamento até 05/10" ou "Cortesia - cliente beta"'
          />
        </div>

        {error && <p className="mb-4 text-sm text-coral-700">{error}</p>}

        <div className="space-y-2">
          {isSuspended ? (
            <button
              onClick={() => run("reactivate", "/api/admin/reactivate-subscription")}
              disabled={busyAction !== null}
              className="btn-primary w-full disabled:opacity-50"
            >
              {busyAction === "reactivate" ? "Reativando..." : "Reativar acesso"}
            </button>
          ) : (
            !isCanceled && (
              <button
                onClick={() => run("suspend", "/api/admin/suspend-subscription")}
                disabled={busyAction !== null}
                className="btn-secondary w-full disabled:opacity-50"
              >
                {busyAction === "suspend" ? "Suspendendo..." : "Suspender acesso"}
              </button>
            )
          )}

          {!isCanceled && (
            <button
              onClick={() => run("promise", "/api/admin/grant-promise")}
              disabled={busyAction !== null}
              className="btn-secondary w-full disabled:opacity-50"
            >
              {busyAction === "promise" ? "Liberando..." : "Liberar (promessa de pagamento)"}
            </button>
          )}

          {!isCanceled && (
            <div className="rounded-lg border border-navy-100 p-3">
              <label className="label-field">Cortesia até (opcional)</label>
              <input
                type="date"
                className="input-field mb-2"
                value={courtesyUntil}
                onChange={(e) => setCourtesyUntil(e.target.value)}
              />
              <button
                onClick={() => run("courtesy", "/api/admin/grant-courtesy", { until: courtesyUntil || null })}
                disabled={busyAction !== null}
                className="btn-secondary w-full disabled:opacity-50"
              >
                {busyAction === "courtesy" ? "Aplicando..." : "Dar cortesia (acesso grátis)"}
              </button>
            </div>
          )}

          {!isCanceled && (
            <button
              onClick={handleCancel}
              disabled={busyAction !== null}
              className="w-full rounded-full border border-coral px-6 py-3 font-semibold text-coral transition hover:bg-coral hover:text-white disabled:opacity-50"
            >
              {busyAction === "cancel" ? "Cancelando..." : "Cancelar assinatura"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
