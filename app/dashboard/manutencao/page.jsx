"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";

const STATUS_LABELS = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const STATUS_STYLES = {
  aberta: "bg-coral-100 text-coral-700",
  em_andamento: "bg-amber-100 text-amber-700",
  concluida: "bg-emerald-100 text-emerald-700",
};

const NEXT_STATUS = {
  aberta: "em_andamento",
  em_andamento: "concluida",
  concluida: "aberta",
};

const emptyForm = { titulo: "", descricao: "", unidade: "" };

export default function ManutencaoPage() {
  const { condominio, temPermissao } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const podeCriar = temPermissao("manutencao", "criar");
  const podeEditar = temPermissao("manutencao", "editar");
  const podeSolicitarProposta = temPermissao("propostas", "criar");

  // Pré-preenche quando chega vindo de "Gerar manutenção" num chamado
  // (?chamadoId=...&titulo=...&descricao=...&unidade=...).
  useEffect(() => {
    const chamadoId = searchParams.get("chamadoId");
    if (!chamadoId) return;
    setForm((f) => ({
      ...f,
      titulo: searchParams.get("titulo") || f.titulo,
      descricao: searchParams.get("descricao") || f.descricao,
      unidade: searchParams.get("unidade") || f.unidade,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("manutencoes")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setOrdens(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim()) return;

    setSubmitting(true);
    setError("");
    const chamadoId = searchParams.get("chamadoId") || null;
    const { error: insertError } = await supabase.from("manutencoes").insert({
      condominio_id: condominio.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      unidade: form.unidade.trim() || null,
      status: "aberta",
      chamado_origem_id: chamadoId,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    if (chamadoId) router.replace("/dashboard/manutencao");
    load();
  }

  async function handleAdvanceStatus(ordem) {
    setUpdatingId(ordem.id);
    const { error: updateError } = await supabase
      .from("manutencoes")
      .update({ status: NEXT_STATUS[ordem.status] })
      .eq("id", ordem.id);
    setUpdatingId(null);
    if (updateError) setError(updateError.message);
    else load();
  }

  function solicitarProposta(ordem) {
    const params = new URLSearchParams({
      manutencaoId: ordem.id,
      titulo: ordem.titulo,
      descricao: ordem.descricao || "",
    });
    router.push(`/dashboard/propostas?${params.toString()}`);
  }

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="manutencao">
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Manutenção</h1>
        <p className="mt-1 text-sm text-navy-500">
          Ordens de serviço: reparos, limpeza e manutenção preventiva.
        </p>

        {podeCriar && (
          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label-field">Título</label>
              <input
                className="input-field"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Troca de lâmpada do hall"
                required
              />
            </div>
            <div>
              <label className="label-field">Unidade / Local (opcional)</label>
              <input
                className="input-field"
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                placeholder="Ex: Bloco B, térreo"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Descrição (opcional)</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Criando..." : "Nova ordem de serviço"}
              </button>
            </div>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando ordens de serviço...</p>
      ) : ordens.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhuma ordem de serviço ainda.</div>
      ) : (
        <div className="space-y-3">
          {ordens.map((o) => (
            <div key={o.id} className="card flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{o.titulo}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[o.status]}`}
                  >
                    {STATUS_LABELS[o.status]}
                  </span>
                </div>
                {o.unidade && <p className="mt-1 text-xs text-navy-400">Local: {o.unidade}</p>}
                {o.descricao && <p className="mt-2 text-sm text-navy-600">{o.descricao}</p>}
                <p className="mt-2 text-xs text-navy-400">
                  {new Date(o.created_at).toLocaleString("pt-BR")}
                  {o.chamado_origem_id && " · Vinculada a um chamado"}
                </p>
                {podeSolicitarProposta && (
                  <button
                    onClick={() => solicitarProposta(o)}
                    className="mt-2 text-xs font-semibold text-navy-700 hover:underline"
                  >
                    Solicitar proposta
                  </button>
                )}
              </div>
              {podeEditar && (
                <button
                  onClick={() => handleAdvanceStatus(o)}
                  disabled={updatingId === o.id}
                  className="btn-secondary flex-none text-sm disabled:opacity-50"
                >
                  {updatingId === o.id ? "..." : `Marcar como ${STATUS_LABELS[NEXT_STATUS[o.status]]}`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </ModuloGuard>
  );
}
