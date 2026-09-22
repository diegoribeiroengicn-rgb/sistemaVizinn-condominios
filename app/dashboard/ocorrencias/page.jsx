"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/adminFetch";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";

const emptyForm = { titulo: "", descricao: "", unidade: "", bloco: "", notificarMorador: false, notificarTodos: false };

export default function OcorrenciasPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const router = useRouter();
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const podeCriar = temPermissao("ocorrencias", "criar");
  const podeGerarChamado = temPermissao("chamados", "criar");
  const registradoPor = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  function gerarChamado(ocorrencia) {
    const params = new URLSearchParams({
      ocorrenciaId: ocorrencia.id,
      titulo: ocorrencia.titulo,
      descricao: ocorrencia.descricao || "",
    });
    router.push(`/dashboard/chamados?${params.toString()}`);
  }

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
    if (form.notificarMorador && !form.unidade.trim()) {
      setError("Informe a unidade para avisar o morador.");
      return;
    }

    setSubmitting(true);
    setError("");
    const { data: ocorrenciaCriada, error: insertError } = await supabase
      .from("ocorrencias")
      .insert({
        condominio_id: condominio.id,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        registrado_por: registradoPor,
        unidade: form.unidade.trim() || null,
        bloco: form.bloco.trim() || null,
        notificar_morador: form.notificarMorador,
        notificar_moradores_geral: form.notificarTodos,
      })
      .select()
      .single();
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (form.notificarMorador) {
      authedFetch("/api/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominio.id,
          evento: "ocorrencia_entrega",
          ocorrenciaId: ocorrenciaCriada.id,
          unidade: form.unidade.trim(),
          bloco: form.bloco.trim() || null,
          descricao: form.descricao.trim(),
        }),
      }).catch((err) => console.error("Erro ao notificar morador:", err));
    }
    if (form.notificarTodos) {
      authedFetch("/api/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominio.id,
          evento: "ocorrencia_aviso_geral",
          referenciaId: ocorrenciaCriada.id,
          titulo: form.titulo.trim(),
          mensagem: form.descricao.trim(),
        }),
      }).catch((err) => console.error("Erro ao notificar moradores:", err));
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

            <div className="rounded-lg border border-navy-100 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-navy-700">
                <input
                  type="checkbox"
                  checked={form.notificarMorador}
                  onChange={(e) => setForm((f) => ({ ...f, notificarMorador: e.target.checked }))}
                />
                Chegou uma entrega — avisar o morador por WhatsApp e e-mail
              </label>
              {form.notificarMorador && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-field">Unidade</label>
                    <input
                      className="input-field"
                      value={form.unidade}
                      onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                      placeholder="Ex: 32"
                      required={form.notificarMorador}
                    />
                  </div>
                  <div>
                    <label className="label-field">Bloco (opcional)</label>
                    <input
                      className="input-field"
                      value={form.bloco}
                      onChange={(e) => setForm((f) => ({ ...f, bloco: e.target.value }))}
                      placeholder="Ex: B"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-navy-100 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-navy-700">
                <input
                  type="checkbox"
                  checked={form.notificarTodos}
                  onChange={(e) => setForm((f) => ({ ...f, notificarTodos: e.target.checked }))}
                />
                Avisar todos os moradores por e-mail sobre essa ocorrência
              </label>
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
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-navy-900">{o.titulo}</h3>
                {o.notificar_morador && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    📦 Morador notificado
                  </span>
                )}
                {o.notificar_moradores_geral && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                    📣 Todos os moradores notificados
                  </span>
                )}
              </div>
              {o.descricao && <p className="mt-1 text-sm text-navy-600">{o.descricao}</p>}
              <p className="mt-2 text-xs text-navy-400">
                {[o.registrado_por, o.unidade && `Apto ${o.unidade}`, o.bloco && `Bloco ${o.bloco}`]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                · {new Date(o.created_at).toLocaleString("pt-BR")}
              </p>
              {podeGerarChamado && (
                <button
                  onClick={() => gerarChamado(o)}
                  className="mt-2 text-xs font-semibold text-navy-700 hover:underline"
                >
                  Gerar chamado
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
