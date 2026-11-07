"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { nomeArquivoSeguro } from "@/lib/storage";
import ModuloGuard from "@/components/ModuloGuard";
import BotaoExcluirComAuditoria from "@/components/BotaoExcluirComAuditoria";

const TIPO_LABELS = { ata: "Ata de assembleia", convencao: "Convenção", regimento_interno: "Regimento interno", outro: "Outro" };
const emptyForm = { tipo: "ata", titulo: "", descricao: "", dataDocumento: "" };

export default function DocumentosPage() {
  const { condominio, temPermissao } = useAuth();
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [arquivo, setArquivo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [abrindoId, setAbrindoId] = useState(null);

  const podeCriar = temPermissao("documentos", "criar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("documentos_institucionais")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("data_documento", { ascending: false, nullsFirst: false });
    if (fetchError) setError(fetchError.message);
    else setDocumentos(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim() || !arquivo) return;
    setSubmitting(true);
    setError("");

    const caminho = `${condominio.id}/${Date.now()}-${nomeArquivoSeguro(arquivo.name)}`;
    const { error: uploadError } = await supabase.storage.from("documentos-institucionais").upload(caminho, arquivo);
    if (uploadError) {
      setSubmitting(false);
      setError(`Erro ao enviar arquivo: ${uploadError.message}`);
      return;
    }

    const { error: insertError } = await supabase.from("documentos_institucionais").insert({
      condominio_id: condominio.id,
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      arquivo_url: caminho,
      data_documento: form.dataDocumento || null,
    });
    setSubmitting(false);
    if (insertError) return setError(insertError.message);
    setForm(emptyForm);
    setArquivo(null);
    load();
  }

  async function handleAbrir(doc) {
    setAbrindoId(doc.id);
    setError("");
    const { data, error: urlError } = await supabase.storage.from("documentos-institucionais").createSignedUrl(doc.arquivo_url, 60);
    setAbrindoId(null);
    if (urlError) return setError(`Erro ao abrir documento: ${urlError.message}`);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (!condominio) return <p className="text-navy-500">Carregando condomínio...</p>;

  return (
    <ModuloGuard modulo="documentos">
      <div className="space-y-6">
        <div className="card">
          <h1 className="font-display text-xl font-bold text-navy-900">Documentos</h1>
          <p className="mt-1 text-sm text-navy-500">Livro de atas, convenção, regimento interno e outros documentos institucionais do condomínio.</p>

          {podeCriar && (
            <form onSubmit={handleUpload} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label-field">Tipo</label>
                <select className="input-field" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPO_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Data do documento (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataDocumento}
                  onChange={(e) => setForm((f) => ({ ...f, dataDocumento: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Título</label>
                <input
                  className="input-field"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Ata da Assembleia Geral Ordinária de 2026"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Descrição (opcional)</label>
                <input
                  className="input-field"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Arquivo (PDF)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                  className="text-sm text-navy-600"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Enviando..." : "Enviar documento"}
                </button>
              </div>
            </form>
          )}
        </div>

        {error && <p className="text-sm text-coral-700">{error}</p>}

        {loading ? (
          <p className="text-navy-500">Carregando documentos...</p>
        ) : documentos.length === 0 ? (
          <div className="card text-center text-navy-400">Nenhum documento cadastrado ainda.</div>
        ) : (
          <div className="space-y-2">
            {documentos.map((doc) => (
              <div key={doc.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-navy-900">{doc.titulo}</h3>
                    <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-600">{TIPO_LABELS[doc.tipo]}</span>
                  </div>
                  {doc.descricao && <p className="mt-1 text-sm text-navy-500">{doc.descricao}</p>}
                  {doc.data_documento && (
                    <p className="mt-1 text-xs text-navy-400">{new Date(`${doc.data_documento}T00:00:00`).toLocaleDateString("pt-BR")}</p>
                  )}
                </div>
                <div className="flex flex-none items-center gap-3">
                  <button onClick={() => handleAbrir(doc)} disabled={abrindoId === doc.id} className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50">
                    {abrindoId === doc.id ? "Abrindo..." : "Ver documento"}
                  </button>
                  {temPermissao("documentos", "excluir") && (
                    <BotaoExcluirComAuditoria
                      tabela="documentos_institucionais"
                      modulo="documentos"
                      registroId={doc.id}
                      descricao="este documento"
                      onExcluido={load}
                      className="text-xs font-semibold text-coral hover:underline"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuloGuard>
  );
}
