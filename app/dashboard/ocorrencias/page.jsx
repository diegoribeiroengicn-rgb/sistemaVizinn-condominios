"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";

const emptyForm = { titulo: "", descricao: "" };

export default function OcorrenciasPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const podeCriar = temPermissao("ocorrencias", "criar");
  const registradoPor = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("ocorrencias")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setOcorrencias(data || []);
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
    const { error: insertError } = await supabase.from("ocorrencias").insert({
      condominio_id: condominio.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      registrado_por: registradoPor,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    load();
  }

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="ocorrencias">
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Ocorrências</h1>
        <p className="mt-1 text-sm text-navy-500">
          Registro da portaria — visitantes, encomendas, incidentes e afins.
        </p>

        {podeCriar && (
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <div>
              <label className="label-field">Título</label>
              <input
                className="input-field"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Entrega de encomenda - Apto 12"
                required
              />
            </div>
            <div>
              <label className="label-field">Descrição (opcional)</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Registrando..." : "Registrar ocorrência"}
            </button>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando ocorrências...</p>
      ) : ocorrencias.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhuma ocorrência registrada ainda.</div>
      ) : (
        <div className="space-y-3">
          {ocorrencias.map((o) => (
            <div key={o.id} className="card">
              <h3 className="font-semibold text-navy-900">{o.titulo}</h3>
              {o.descricao && <p className="mt-1 text-sm text-navy-600">{o.descricao}</p>}
              <p className="mt-2 text-xs text-navy-400">
                {o.registrado_por} · {new Date(o.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
    </ModuloGuard>
  );
}
