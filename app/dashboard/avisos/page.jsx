"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";

const emptyForm = { titulo: "", mensagem: "" };

export default function AvisosPage() {
  const { condominio, temPermissao } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const podeCriar = temPermissao("avisos", "criar");
  const podeExcluir = temPermissao("avisos", "excluir");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("avisos")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setAvisos(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim() || !form.mensagem.trim()) return;

    setSubmitting(true);
    setError("");
    const { error: insertError } = await supabase.from("avisos").insert({
      condominio_id: condominio.id,
      titulo: form.titulo.trim(),
      mensagem: form.mensagem.trim(),
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Excluir este aviso?")) return;
    setDeletingId(id);
    const { error: deleteError } = await supabase.from("avisos").delete().eq("id", id);
    setDeletingId(null);
    if (deleteError) setError(deleteError.message);
    else load();
  }

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="avisos">
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Avisos</h1>
        <p className="mt-1 text-sm text-navy-500">
          {podeCriar
            ? "Publique comunicados para todos os condôminos."
            : "Comunicados do síndico para o condomínio."}
        </p>

        {podeCriar && (
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <div>
              <label className="label-field">Título</label>
              <input
                className="input-field"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Manutenção do elevador"
                required
              />
            </div>
            <div>
              <label className="label-field">Mensagem</label>
              <textarea
                className="input-field"
                rows={3}
                value={form.mensagem}
                onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
                required
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Publicando..." : "Publicar aviso"}
            </button>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando avisos...</p>
      ) : avisos.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum aviso publicado ainda.</div>
      ) : (
        <div className="space-y-3">
          {avisos.map((a) => (
            <div key={a.id} className="card flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-navy-900">{a.titulo}</h3>
                <p className="mt-1 text-sm text-navy-600">{a.mensagem}</p>
                <p className="mt-2 text-xs text-navy-400">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              {podeExcluir && (
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="flex-none text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                >
                  {deletingId === a.id ? "..." : "Excluir"}
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
