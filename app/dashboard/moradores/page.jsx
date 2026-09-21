"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import { parseMoradoresCsv, gerarModeloCsv, COLUNAS_RELATORIO } from "@/lib/moradores";
import { baixarArquivo } from "@/lib/csv";
import { gerarPdf, gerarDocx } from "@/lib/relatorios";

const emptyForm = { unidade: "", bloco: "", nome: "", telefone: "", email: "", observacoes: "" };

export default function MoradoresPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";
  const [exportando, setExportando] = useState(null);
  const [moradores, setMoradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [busca, setBusca] = useState("");

  const [preview, setPreview] = useState(null); // { linhas, erros }
  const [importando, setImportando] = useState(false);
  const [importResumo, setImportResumo] = useState("");
  const fileInputRef = useRef(null);

  const podeCriar = temPermissao("moradores", "criar");
  const podeEditar = temPermissao("moradores", "editar");
  const podeExcluir = temPermissao("moradores", "excluir");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("moradores")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("unidade", { ascending: true });
    if (fetchError) setError(fetchError.message);
    else setMoradores(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!condominio?.id || !form.unidade.trim() || !form.nome.trim()) return;

    setSubmitting(true);
    setError("");

    const payload = {
      condominio_id: condominio.id,
      unidade: form.unidade.trim(),
      bloco: form.bloco.trim() || null,
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      observacoes: form.observacoes.trim() || null,
    };

    const query = editingId
      ? supabase.from("moradores").update(payload).eq("id", editingId)
      : supabase.from("moradores").insert(payload);
    const { error: saveError } = await query;
    setSubmitting(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    resetForm();
    load();
  }

  function openEdit(morador) {
    setError("");
    setEditingId(morador.id);
    setForm({
      unidade: morador.unidade,
      bloco: morador.bloco || "",
      nome: morador.nome,
      telefone: morador.telefone || "",
      email: morador.email || "",
      observacoes: morador.observacoes || "",
    });
  }

  async function handleRemove(morador) {
    if (!confirm(`Remover "${morador.nome}" (unidade ${morador.unidade}) do cadastro?`)) return;
    setRemovingId(morador.id);
    const { error: deleteError } = await supabase.from("moradores").delete().eq("id", morador.id);
    setRemovingId(null);
    if (deleteError) setError(deleteError.message);
    else load();
  }

  function handleArquivoSelecionado(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResumo("");
    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result || "");
      const resultado = parseMoradoresCsv(texto);
      setPreview(resultado);
    };
    reader.onerror = () => setError("Não consegui ler o arquivo. Tente novamente.");
    reader.readAsText(file, "utf-8");
  }

  function cancelarImportacao() {
    setPreview(null);
    setImportResumo("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmarImportacao() {
    if (!condominio?.id || !preview?.linhas?.length) return;
    setImportando(true);
    setError("");

    const payload = preview.linhas.map((l) => ({
      condominio_id: condominio.id,
      unidade: l.unidade,
      bloco: l.bloco || null,
      nome: l.nome,
      telefone: l.telefone || null,
      email: l.email || null,
    }));

    const { error: importError } = await supabase.from("moradores").insert(payload);
    setImportando(false);

    if (importError) {
      setError(importError.message);
      return;
    }
    setImportResumo(`${payload.length} morador(es) importado(s) com sucesso.`);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  function baixarModelo() {
    baixarArquivo(gerarModeloCsv(), "modelo-moradores.csv");
  }

  function montarConfigRelatorio() {
    return {
      condominioNome: condominio?.nome,
      tipoLabel: "Moradores",
      periodoLabel: "",
      filtros: busca ? [{ label: "Busca", valor: busca }] : [],
      colunas: COLUNAS_RELATORIO,
      linhas: moradoresFiltrados,
      resumo: [{ label: "Total de moradores", valor: moradoresFiltrados.length }],
      geradoEm: new Date(),
      geradoPor: nomeUsuario,
    };
  }

  async function handleExportarPdf() {
    setExportando("pdf");
    try {
      gerarPdf(montarConfigRelatorio());
    } finally {
      setExportando(null);
    }
  }

  async function handleExportarDocx() {
    setExportando("docx");
    try {
      await gerarDocx(montarConfigRelatorio());
    } finally {
      setExportando(null);
    }
  }

  const moradoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return moradores;
    return moradores.filter((m) =>
      [m.unidade, m.bloco, m.nome, m.telefone, m.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(termo))
    );
  }, [moradores, busca]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="moradores">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Moradores</h1>
          <p className="mt-1 text-sm text-navy-500">
            Cadastro de quem mora em cada unidade — não precisa ter login no Vizinn. Usado para
            avisar automaticamente por WhatsApp/e-mail quando chega uma encomenda (Ocorrências).
          </p>
        </div>

        <div className="card">
          <p className="text-xs text-navy-400">Total cadastrado</p>
          <p className="mt-1 font-display text-xl font-bold text-navy-900">{moradores.length}</p>
        </div>

        {podeCriar && (
          <div className="card">
            <h2 className="font-display text-lg font-bold text-navy-900">Importar de uma planilha</h2>
            <p className="mt-1 text-sm text-navy-500">
              Baixe o modelo, preencha unidade/apartamento, bloco, nome e telefone (e-mail é
              opcional) e suba o arquivo de volta aqui.
            </p>
            <div className="mt-4">
              <button type="button" onClick={baixarModelo} className="btn-primary">
                ⬇ Baixar modelo de planilha
              </button>
            </div>
            <div className="mt-4 border-t border-navy-100 pt-4">
              <label className="label-field">Já preencheu? Suba o arquivo aqui</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleArquivoSelecionado}
                className="text-sm text-navy-600"
              />
            </div>

            {importResumo && <p className="mt-3 text-sm font-medium text-emerald-700">{importResumo}</p>}

            {preview && (
              <div className="mt-4 space-y-3">
                {preview.erros.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    {preview.erros.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                )}

                {preview.linhas.length === 0 ? (
                  <p className="text-sm text-coral-700">Nenhuma linha válida encontrada no arquivo.</p>
                ) : (
                  <>
                    <p className="text-sm text-navy-600">
                      Encontrei <strong>{preview.linhas.length}</strong> morador(es) para importar. Confira antes de
                      confirmar:
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-navy-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-navy-50 text-navy-500">
                          <tr>
                            <th className="px-3 py-2">Unidade</th>
                            <th className="px-3 py-2">Bloco</th>
                            <th className="px-3 py-2">Nome</th>
                            <th className="px-3 py-2">Telefone</th>
                            <th className="px-3 py-2">E-mail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.linhas.map((l, i) => (
                            <tr key={i} className="border-t border-navy-50">
                              <td className="px-3 py-1.5">{l.unidade}</td>
                              <td className="px-3 py-1.5">{l.bloco}</td>
                              <td className="px-3 py-1.5">{l.nome}</td>
                              <td className="px-3 py-1.5">{l.telefone}</td>
                              <td className="px-3 py-1.5">{l.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={confirmarImportacao}
                        disabled={importando}
                        className="btn-primary"
                      >
                        {importando ? "Importando..." : `Confirmar importação (${preview.linhas.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={cancelarImportacao}
                        className="text-sm font-semibold text-navy-500 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {podeCriar && (
          <div className="card">
            <h2 className="font-display text-lg font-bold text-navy-900">
              {editingId ? "Editar morador" : "Cadastrar manualmente"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label-field">Unidade</label>
                <input
                  className="input-field"
                  value={form.unidade}
                  onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                  placeholder="Ex: 101"
                  required
                />
              </div>
              <div>
                <label className="label-field">Bloco (opcional)</label>
                <input
                  className="input-field"
                  value={form.bloco}
                  onChange={(e) => setForm((f) => ({ ...f, bloco: e.target.value }))}
                  placeholder="Ex: A"
                />
              </div>
              <div>
                <label className="label-field">Nome completo</label>
                <input
                  className="input-field"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label-field">Telefone / WhatsApp (opcional)</label>
                <input
                  className="input-field"
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                  placeholder="Ex: 11999998888"
                />
              </div>
              <div>
                <label className="label-field">E-mail (opcional)</label>
                <input
                  type="email"
                  className="input-field"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Observações (opcional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar morador"}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="text-sm font-semibold text-navy-500 hover:underline">
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {error && <p className="text-sm text-coral-700">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input-field flex-1"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por unidade, bloco ou nome..."
          />
          <button
            onClick={handleExportarPdf}
            disabled={Boolean(exportando) || moradoresFiltrados.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            {exportando === "pdf" ? "Gerando..." : "Baixar PDF"}
          </button>
          <button
            onClick={handleExportarDocx}
            disabled={Boolean(exportando) || moradoresFiltrados.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            {exportando === "docx" ? "Gerando..." : "Baixar Word"}
          </button>
        </div>

        {loading ? (
          <p className="text-navy-500">Carregando moradores...</p>
        ) : moradoresFiltrados.length === 0 ? (
          <div className="card text-center text-navy-400">
            {moradores.length === 0 ? "Nenhum morador cadastrado ainda." : "Nenhum morador encontrado."}
          </div>
        ) : (
          <div className="space-y-3">
            {moradoresFiltrados.map((m) => (
              <div key={m.id} className="card">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{m.nome}</h3>
                  <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                    Unidade {m.unidade}
                    {m.bloco ? ` · Bloco ${m.bloco}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-navy-400">{[m.telefone, m.email].filter(Boolean).join(" · ")}</p>
                {m.observacoes && <p className="mt-2 text-sm text-navy-600">{m.observacoes}</p>}
                <div className="mt-3 flex flex-wrap gap-3">
                  {podeEditar && (
                    <button onClick={() => openEdit(m)} className="text-xs font-semibold text-navy-700 hover:underline">
                      Editar
                    </button>
                  )}
                  {podeExcluir && (
                    <button
                      onClick={() => handleRemove(m)}
                      disabled={removingId === m.id}
                      className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                    >
                      {removingId === m.id ? "Removendo..." : "Remover"}
                    </button>
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
