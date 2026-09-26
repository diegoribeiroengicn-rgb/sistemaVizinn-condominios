"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import {
  FUNCAO_SUGESTOES,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_STYLES,
  formatarWhatsapp,
  parseColaboradoresCsv,
  parseColaboradoresXlsx,
  gerarModeloColaboradores,
  COLUNAS_RELATORIO,
} from "@/lib/colaboradores";
import { baixarBlob } from "@/lib/xlsx";
import { gerarPdf, gerarDocx } from "@/lib/relatorios";

const emptyForm = {
  nome: "",
  cpf: "",
  funcao: "",
  setor: "",
  telefone: "",
  whatsappDdi: "55",
  whatsappDdd: "",
  whatsappNumero: "",
  temWhatsapp: false,
  email: "",
  dataInicio: "",
  status: "ativo",
  observacoes: "",
  possuiAcesso: false,
  membroId: "",
};

export default function ColaboradoresPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";
  const [colaboradores, setColaboradores] = useState([]);
  const [membros, setMembros] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("");

  const [preview, setPreview] = useState(null); // { linhas, erros }
  const [importando, setImportando] = useState(false);
  const [importResumo, setImportResumo] = useState("");
  const [exportando, setExportando] = useState(null);
  const [gerandoModelo, setGerandoModelo] = useState(false);
  const fileInputRef = useRef(null);

  const podeCriar = temPermissao("colaboradores", "criar");
  const podeEditar = temPermissao("colaboradores", "editar");
  const podeExcluir = temPermissao("colaboradores", "excluir");
  const podeAcessos = temPermissao("acessos", "visualizar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const [cResult, mResult, chResult, manResult] = await Promise.all([
      supabase.from("colaboradores").select("*").eq("condominio_id", condominio.id).order("nome", { ascending: true }),
      podeAcessos
        ? supabase.from("membros").select("id, nome, papel").eq("condominio_id", condominio.id)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("chamados")
        .select("id, status, responsavel_colaborador_id")
        .eq("condominio_id", condominio.id)
        .not("responsavel_colaborador_id", "is", null),
      supabase
        .from("manutencoes")
        .select("id, status, responsavel_colaborador_id")
        .eq("condominio_id", condominio.id)
        .not("responsavel_colaborador_id", "is", null),
    ]);

    if (cResult.error) setError(cResult.error.message);
    else setColaboradores(cResult.data || []);
    if (!mResult.error) setMembros(mResult.data || []);
    if (!chResult.error) setChamados(chResult.data || []);
    if (!manResult.error) setManutencoes(manResult.data || []);
    setLoading(false);
  }, [condominio?.id, podeAcessos]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!condominio?.id || !form.nome.trim() || !form.funcao.trim()) return;

    setSubmitting(true);
    setError("");

    const payload = {
      condominio_id: condominio.id,
      nome: form.nome.trim(),
      cpf: form.cpf.trim() || null,
      funcao: form.funcao.trim(),
      setor: form.setor.trim() || null,
      telefone: form.telefone.trim() || null,
      whatsapp_ddi: form.temWhatsapp ? form.whatsappDdi.trim() || null : null,
      whatsapp_ddd: form.temWhatsapp ? form.whatsappDdd.trim() || null : null,
      whatsapp_numero: form.temWhatsapp ? form.whatsappNumero.trim() || null : null,
      tem_whatsapp: form.temWhatsapp && Boolean(form.whatsappNumero.trim()),
      email: form.email.trim() || null,
      data_inicio: form.dataInicio || null,
      status: form.status,
      observacoes: form.observacoes.trim() || null,
      possui_acesso: form.possuiAcesso,
      membro_id: form.possuiAcesso && form.membroId ? form.membroId : null,
    };

    const query = editingId
      ? supabase.from("colaboradores").update(payload).eq("id", editingId)
      : supabase.from("colaboradores").insert(payload);
    const { error: saveError } = await query;
    setSubmitting(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    resetForm();
    load();
  }

  function openEdit(colaborador) {
    setError("");
    setEditingId(colaborador.id);
    setForm({
      nome: colaborador.nome,
      cpf: colaborador.cpf || "",
      funcao: colaborador.funcao,
      setor: colaborador.setor || "",
      telefone: colaborador.telefone || "",
      whatsappDdi: colaborador.whatsapp_ddi || "55",
      whatsappDdd: colaborador.whatsapp_ddd || "",
      whatsappNumero: colaborador.whatsapp_numero || "",
      temWhatsapp: Boolean(colaborador.tem_whatsapp),
      email: colaborador.email || "",
      dataInicio: colaborador.data_inicio || "",
      status: colaborador.status,
      observacoes: colaborador.observacoes || "",
      possuiAcesso: colaborador.possui_acesso,
      membroId: colaborador.membro_id || "",
    });
  }

  async function handleRemove(colaborador) {
    if (!confirm(`Remover "${colaborador.nome}" dos colaboradores?`)) return;
    setRemovingId(colaborador.id);
    const { error: deleteError } = await supabase.from("colaboradores").delete().eq("id", colaborador.id);
    setRemovingId(null);
    if (deleteError) setError(deleteError.message);
    else load();
  }

  function handleArquivoSelecionado(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResumo("");
    const reader = new FileReader();
    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.onload = () => setPreview(parseColaboradoresCsv(String(reader.result || "")));
      reader.onerror = () => setError("Não consegui ler o arquivo. Tente novamente.");
      reader.readAsText(file, "utf-8");
    } else {
      reader.onload = async () => setPreview(await parseColaboradoresXlsx(reader.result));
      reader.onerror = () => setError("Não consegui ler o arquivo. Tente novamente.");
      reader.readAsArrayBuffer(file);
    }
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
      nome: l.nome,
      funcao: l.funcao,
      setor: l.setor || null,
      telefone: l.telefone || null,
      email: l.email || null,
      status: "ativo",
    }));

    const { error: importError } = await supabase.from("colaboradores").insert(payload);
    setImportando(false);

    if (importError) {
      setError(importError.message);
      return;
    }
    setImportResumo(`${payload.length} colaborador(es) importado(s) com sucesso.`);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  async function baixarModelo() {
    setGerandoModelo(true);
    try {
      const blob = await gerarModeloColaboradores();
      baixarBlob(blob, "modelo-colaboradores.xlsx");
    } finally {
      setGerandoModelo(false);
    }
  }

  const indicadoresPorColaborador = useMemo(() => {
    const mapa = {};
    for (const c of colaboradores) {
      const chamadosDele = chamados.filter((ch) => ch.responsavel_colaborador_id === c.id);
      const manutencoesDele = manutencoes.filter((m) => m.responsavel_colaborador_id === c.id);
      const chamadosPendentes = chamadosDele.filter((ch) => !["concluido", "cancelado"].includes(ch.status));
      const manutencoesPendentes = manutencoesDele.filter((m) => m.status !== "concluida");
      mapa[c.id] = {
        chamadosPendentes: chamadosPendentes.length,
        chamadosConcluidos: chamadosDele.filter((ch) => ch.status === "concluido").length,
        manutencoesPendentes: manutencoesPendentes.length,
      };
    }
    return mapa;
  }, [colaboradores, chamados, manutencoes]);

  const resumo = useMemo(() => {
    return {
      ativos: colaboradores.filter((c) => c.status === "ativo").length,
      comLogin: colaboradores.filter((c) => c.possui_acesso).length,
      semLogin: colaboradores.filter((c) => !c.possui_acesso).length,
      ferias: colaboradores.filter((c) => c.status === "ferias").length,
      afastados: colaboradores.filter((c) => c.status === "afastado").length,
    };
  }, [colaboradores]);

  const colaboradoresFiltrados = filtroStatus
    ? colaboradores.filter((c) => c.status === filtroStatus)
    : colaboradores;

  function montarConfigRelatorio() {
    return {
      condominioNome: condominio?.nome,
      tipoLabel: "Colaboradores",
      periodoLabel: "",
      filtros: filtroStatus ? [{ label: "Status", valor: STATUS_LABELS[filtroStatus] }] : [],
      colunas: COLUNAS_RELATORIO,
      linhas: colaboradoresFiltrados.map((c) => ({ ...c, statusLabel: STATUS_LABELS[c.status] })),
      resumo: [{ label: "Total de colaboradores", valor: colaboradoresFiltrados.length }],
      geradoEm: new Date(),
      geradoPor: nomeUsuario,
    };
  }

  async function handleExportarPdf() {
    setExportando("pdf");
    try {
      await gerarPdf(montarConfigRelatorio());
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

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="colaboradores">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Colaboradores</h1>
          <p className="mt-1 text-sm text-navy-500">
            Quem trabalha no condomínio — com ou sem login no Vizinn. Diferente de Acessos, que é
            sobre quem entra no sistema.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card">
            <p className="text-xs text-navy-400">Ativos</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{resumo.ativos}</p>
          </div>
          <div className="card">
            <p className="text-xs text-navy-400">Com login</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{resumo.comLogin}</p>
          </div>
          <div className="card">
            <p className="text-xs text-navy-400">Sem login</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{resumo.semLogin}</p>
          </div>
          <div className="card">
            <p className="text-xs text-navy-400">Férias / afastados</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">
              {resumo.ferias + resumo.afastados}
            </p>
          </div>
        </div>

        {podeCriar && (
          <div className="card">
            <h2 className="font-display text-lg font-bold text-navy-900">Importar de uma planilha</h2>
            <p className="mt-1 text-sm text-navy-500">
              Baixe o modelo em Excel já formatado, preencha nome, função, setor e telefone
              (e-mail é opcional) e suba o arquivo de volta aqui.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={baixarModelo}
                disabled={gerandoModelo}
                className="btn-primary border-2 border-navy-900/20 px-8 py-4 text-base disabled:opacity-60"
              >
                {gerandoModelo ? "Gerando..." : "⬇ Baixar modelo de planilha"}
              </button>
            </div>
            <div className="mt-4 border-t border-navy-100 pt-4">
              <label className="label-field">Já preencheu? Suba o arquivo aqui (.xlsx ou .csv)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                      Encontrei <strong>{preview.linhas.length}</strong> colaborador(es) para importar. Confira antes
                      de confirmar:
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-navy-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-navy-50 text-navy-500">
                          <tr>
                            <th className="px-3 py-2">Nome</th>
                            <th className="px-3 py-2">Função</th>
                            <th className="px-3 py-2">Setor</th>
                            <th className="px-3 py-2">Telefone</th>
                            <th className="px-3 py-2">E-mail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.linhas.map((l, i) => (
                            <tr key={i} className="border-t border-navy-50">
                              <td className="px-3 py-1.5">{l.nome}</td>
                              <td className="px-3 py-1.5">{l.funcao}</td>
                              <td className="px-3 py-1.5">{l.setor}</td>
                              <td className="px-3 py-1.5">{l.telefone}</td>
                              <td className="px-3 py-1.5">{l.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={confirmarImportacao} disabled={importando} className="btn-primary">
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
              {editingId ? "Editar colaborador" : "Novo colaborador"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <label className="label-field">Função</label>
                <input
                  className="input-field"
                  list="funcoes-colaborador"
                  value={form.funcao}
                  onChange={(e) => setForm((f) => ({ ...f, funcao: e.target.value }))}
                  required
                />
                <datalist id="funcoes-colaborador">
                  {FUNCAO_SUGESTOES.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label-field">Setor (opcional)</label>
                <input
                  className="input-field"
                  value={form.setor}
                  onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">CPF (opcional)</label>
                <input
                  className="input-field"
                  value={form.cpf}
                  onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Status</label>
                <select
                  className="input-field"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Data de início (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataInicio}
                  onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Telefone (opcional)</label>
                <input
                  className="input-field"
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
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
                <label className="flex items-center gap-2 text-sm text-navy-600">
                  <input
                    type="checkbox"
                    checked={form.temWhatsapp}
                    onChange={(e) => setForm((f) => ({ ...f, temWhatsapp: e.target.checked }))}
                  />
                  Tem WhatsApp
                </label>
                {form.temWhatsapp && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input
                      className="input-field"
                      placeholder="DDI"
                      value={form.whatsappDdi}
                      onChange={(e) => setForm((f) => ({ ...f, whatsappDdi: e.target.value }))}
                    />
                    <input
                      className="input-field"
                      placeholder="DDD"
                      value={form.whatsappDdd}
                      onChange={(e) => setForm((f) => ({ ...f, whatsappDdd: e.target.value }))}
                    />
                    <input
                      className="input-field"
                      placeholder="Número"
                      value={form.whatsappNumero}
                      onChange={(e) => setForm((f) => ({ ...f, whatsappNumero: e.target.value }))}
                    />
                  </div>
                )}
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

              <div className="sm:col-span-2 rounded-lg border border-navy-100 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-navy-700">
                  <input
                    type="checkbox"
                    checked={form.possuiAcesso}
                    onChange={(e) => setForm((f) => ({ ...f, possuiAcesso: e.target.checked, membroId: "" }))}
                  />
                  Possui acesso ao Vizinn
                </label>
                {form.possuiAcesso && (
                  <div className="mt-2">
                    <label className="label-field">Vincular a um acesso existente (opcional)</label>
                    <select
                      className="input-field"
                      value={form.membroId}
                      onChange={(e) => setForm((f) => ({ ...f, membroId: e.target.value }))}
                    >
                      <option value="">Ainda não vinculado</option>
                      {membros.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} — {m.papel}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar colaborador"}
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
          <select className="input-field w-auto" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            onClick={handleExportarPdf}
            disabled={Boolean(exportando) || colaboradoresFiltrados.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            {exportando === "pdf" ? "Gerando..." : "Baixar PDF"}
          </button>
          <button
            onClick={handleExportarDocx}
            disabled={Boolean(exportando) || colaboradoresFiltrados.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            {exportando === "docx" ? "Gerando..." : "Baixar Word"}
          </button>
        </div>

        {loading ? (
          <p className="text-navy-500">Carregando colaboradores...</p>
        ) : colaboradoresFiltrados.length === 0 ? (
          <div className="card text-center text-navy-400">Nenhum colaborador cadastrado ainda.</div>
        ) : (
          <div className="space-y-3">
            {colaboradoresFiltrados.map((c) => {
              const ind = indicadoresPorColaborador[c.id] || {};
              const whatsapp = formatarWhatsapp(c);
              return (
                <div key={c.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy-900">{c.nome}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                        <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                          {c.funcao}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.possui_acesso ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
                          }`}
                        >
                          {c.possui_acesso ? "Possui login" : "Sem login"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-navy-400">
                        {[c.setor, c.telefone, whatsapp, c.email].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>

                  {c.observacoes && <p className="mt-2 text-sm text-navy-600">{c.observacoes}</p>}

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-navy-50/50 p-3 text-xs">
                    <div>
                      <p className="text-navy-400">Chamados pendentes</p>
                      <p className="font-semibold text-navy-800">{ind.chamadosPendentes || 0}</p>
                    </div>
                    <div>
                      <p className="text-navy-400">Chamados concluídos</p>
                      <p className="font-semibold text-navy-800">{ind.chamadosConcluidos || 0}</p>
                    </div>
                    <div>
                      <p className="text-navy-400">Manutenções pendentes</p>
                      <p className="font-semibold text-navy-800">{ind.manutencoesPendentes || 0}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3">
                    {podeEditar && (
                      <button onClick={() => openEdit(c)} className="text-xs font-semibold text-navy-700 hover:underline">
                        Editar
                      </button>
                    )}
                    {podeExcluir && (
                      <button
                        onClick={() => handleRemove(c)}
                        disabled={removingId === c.id}
                        className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                      >
                        {removingId === c.id ? "Removendo..." : "Remover"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModuloGuard>
  );
}
