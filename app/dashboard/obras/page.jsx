"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import { STATUS_ORDER, STATUS_LABELS, STATUS_STYLES } from "@/lib/obras";
import { formatarMoeda } from "@/lib/financeiro";

const emptyForm = {
  titulo: "",
  descricao: "",
  local: "",
  colaboradorId: "",
  responsavelNome: "",
  fornecedorId: "",
  fornecedorNome: "",
  dataPrevistaInicio: "",
  dataPrevistaConclusao: "",
  dataRealInicio: "",
  dataRealConclusao: "",
  valorPrevisto: "",
  valorRealizado: "",
  status: "planejada",
  observacoes: "",
};

function formatarData(data) {
  return data ? new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR") : "-";
}

export default function ObrasPage() {
  const { condominio, temPermissao } = useAuth();
  const [obras, setObras] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");

  const podeCriar = temPermissao("obras", "criar");
  const podeEditar = temPermissao("obras", "editar");
  const podeExcluir = temPermissao("obras", "excluir");
  const podeColaboradores = temPermissao("colaboradores", "visualizar");
  const podeFornecedores = temPermissao("fornecedores", "visualizar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const [oResult, cResult, fResult] = await Promise.all([
      supabase.from("obras").select("*").eq("condominio_id", condominio.id).order("created_at", { ascending: false }),
      podeColaboradores
        ? supabase
            .from("colaboradores")
            .select("id, nome, funcao, status")
            .eq("condominio_id", condominio.id)
            .eq("status", "ativo")
            .order("nome", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      podeFornecedores
        ? supabase.from("fornecedores").select("id, razao_social").eq("condominio_id", condominio.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (oResult.error) setError(oResult.error.message);
    else setObras(oResult.data || []);
    if (!cResult.error) setColaboradores(cResult.data || []);
    if (!fResult.error) setFornecedores(fResult.data || []);
    setLoading(false);
  }, [condominio?.id, podeColaboradores, podeFornecedores]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim()) return;

    setSubmitting(true);
    setError("");

    const colaboradorSelecionado = colaboradores.find((c) => c.id === form.colaboradorId);
    const fornecedorSelecionado = fornecedores.find((f) => f.id === form.fornecedorId);

    const payload = {
      condominio_id: condominio.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      local: form.local.trim() || null,
      responsavel_colaborador_id: form.colaboradorId || null,
      responsavel_nome: colaboradorSelecionado?.nome || form.responsavelNome.trim() || null,
      fornecedor_id: form.fornecedorId || null,
      fornecedor_nome: fornecedorSelecionado?.razao_social || form.fornecedorNome.trim() || null,
      data_prevista_inicio: form.dataPrevistaInicio || null,
      data_prevista_conclusao: form.dataPrevistaConclusao || null,
      data_real_inicio: form.dataRealInicio || null,
      data_real_conclusao: form.dataRealConclusao || null,
      valor_previsto: form.valorPrevisto ? Number(form.valorPrevisto) : null,
      valor_realizado: form.valorRealizado ? Number(form.valorRealizado) : null,
      status: form.status,
      observacoes: form.observacoes.trim() || null,
    };

    const query = editingId
      ? supabase.from("obras").update(payload).eq("id", editingId)
      : supabase.from("obras").insert(payload);
    const { error: saveError } = await query;
    setSubmitting(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    resetForm();
    load();
  }

  function openEdit(obra) {
    setError("");
    setEditingId(obra.id);
    setForm({
      titulo: obra.titulo,
      descricao: obra.descricao || "",
      local: obra.local || "",
      colaboradorId: obra.responsavel_colaborador_id || "",
      responsavelNome: obra.responsavel_colaborador_id ? "" : obra.responsavel_nome || "",
      fornecedorId: obra.fornecedor_id || "",
      fornecedorNome: obra.fornecedor_id ? "" : obra.fornecedor_nome || "",
      dataPrevistaInicio: obra.data_prevista_inicio || "",
      dataPrevistaConclusao: obra.data_prevista_conclusao || "",
      dataRealInicio: obra.data_real_inicio || "",
      dataRealConclusao: obra.data_real_conclusao || "",
      valorPrevisto: obra.valor_previsto ?? "",
      valorRealizado: obra.valor_realizado ?? "",
      status: obra.status,
      observacoes: obra.observacoes || "",
    });
  }

  async function handleRemove(obra) {
    if (!confirm(`Remover "${obra.titulo}" de Obras e Melhorias?`)) return;
    setRemovingId(obra.id);
    const { error: deleteError } = await supabase.from("obras").delete().eq("id", obra.id);
    setRemovingId(null);
    if (deleteError) setError(deleteError.message);
    else load();
  }

  const resumo = useMemo(() => {
    return {
      emAndamento: obras.filter((o) => o.status === "em_andamento").length,
      planejadas: obras.filter((o) => ["planejada", "em_orcamento", "aprovada"].includes(o.status)).length,
      concluidas: obras.filter((o) => o.status === "concluida").length,
      pausadas: obras.filter((o) => o.status === "pausada").length,
    };
  }, [obras]);

  const obrasFiltradas = useMemo(() => {
    let lista = filtroStatus ? obras.filter((o) => o.status === filtroStatus) : obras;
    const termo = busca.trim().toLowerCase();
    if (termo) {
      lista = lista.filter((o) =>
        [o.titulo, o.local, o.responsavel_nome, o.fornecedor_nome].filter(Boolean).some((v) => v.toLowerCase().includes(termo))
      );
    }
    return lista;
  }, [obras, filtroStatus, busca]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="obras">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Obras e Melhorias</h1>
          <p className="mt-1 text-sm text-navy-500">
            Registro e acompanhamento de obras, reformas e intervenções no condomínio — planejamento,
            orçamento e prazos.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card">
            <p className="text-xs text-navy-400">Em andamento</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{resumo.emAndamento}</p>
          </div>
          <div className="card">
            <p className="text-xs text-navy-400">Planejadas</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{resumo.planejadas}</p>
          </div>
          <div className="card">
            <p className="text-xs text-navy-400">Pausadas</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{resumo.pausadas}</p>
          </div>
          <div className="card">
            <p className="text-xs text-navy-400">Concluídas</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{resumo.concluidas}</p>
          </div>
        </div>

        {podeCriar && (
          <div className="card">
            <h2 className="font-display text-lg font-bold text-navy-900">
              {editingId ? "Editar obra/melhoria" : "Nova obra/melhoria"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field">Título</label>
                <input
                  className="input-field"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Reforma da fachada"
                  required
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
              <div>
                <label className="label-field">Local (opcional)</label>
                <input
                  className="input-field"
                  value={form.local}
                  onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                  placeholder="Ex: Fachada, garagem, playground..."
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

              {colaboradores.length > 0 ? (
                <div>
                  <label className="label-field">Responsável (opcional)</label>
                  <select
                    className="input-field"
                    value={form.colaboradorId}
                    onChange={(e) => setForm((f) => ({ ...f, colaboradorId: e.target.value, responsavelNome: "" }))}
                  >
                    <option value="">Sem responsável vinculado</option>
                    {colaboradores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} — {c.funcao}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label-field">Responsável (opcional)</label>
                  <input
                    className="input-field"
                    value={form.responsavelNome}
                    onChange={(e) => setForm((f) => ({ ...f, responsavelNome: e.target.value }))}
                  />
                </div>
              )}

              {fornecedores.length > 0 ? (
                <div>
                  <label className="label-field">Empresa/fornecedor (opcional)</label>
                  <select
                    className="input-field"
                    value={form.fornecedorId}
                    onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value, fornecedorNome: "" }))}
                  >
                    <option value="">Sem fornecedor</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.razao_social}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label-field">Empresa/fornecedor (opcional)</label>
                  <input
                    className="input-field"
                    value={form.fornecedorNome}
                    onChange={(e) => setForm((f) => ({ ...f, fornecedorNome: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="label-field">Início previsto (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataPrevistaInicio}
                  onChange={(e) => setForm((f) => ({ ...f, dataPrevistaInicio: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Conclusão prevista (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataPrevistaConclusao}
                  onChange={(e) => setForm((f) => ({ ...f, dataPrevistaConclusao: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Início real (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataRealInicio}
                  onChange={(e) => setForm((f) => ({ ...f, dataRealInicio: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Conclusão real (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataRealConclusao}
                  onChange={(e) => setForm((f) => ({ ...f, dataRealConclusao: e.target.value }))}
                />
              </div>

              <div>
                <label className="label-field">Valor previsto (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={form.valorPrevisto}
                  onChange={(e) => setForm((f) => ({ ...f, valorPrevisto: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Valor realizado (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={form.valorRealizado}
                  onChange={(e) => setForm((f) => ({ ...f, valorRealizado: e.target.value }))}
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
                  {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar obra/melhoria"}
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
          <input
            className="input-field flex-1"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, local, responsável ou fornecedor..."
          />
        </div>

        {loading ? (
          <p className="text-navy-500">Carregando obras...</p>
        ) : obrasFiltradas.length === 0 ? (
          <div className="card text-center text-navy-400">
            {obras.length === 0 ? "Nenhuma obra ou melhoria cadastrada ainda." : "Nenhum registro encontrado."}
          </div>
        ) : (
          <div className="space-y-3">
            {obrasFiltradas.map((o) => (
              <div key={o.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-navy-900">{o.titulo}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-navy-400">
                      {[o.local, o.responsavel_nome, o.fornecedor_nome].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {(o.valor_previsto || o.valor_realizado) && (
                    <div className="text-right text-xs text-navy-400">
                      {o.valor_previsto != null && <p>Previsto: {formatarMoeda(o.valor_previsto)}</p>}
                      {o.valor_realizado != null && <p>Realizado: {formatarMoeda(o.valor_realizado)}</p>}
                    </div>
                  )}
                </div>

                {o.descricao && <p className="mt-2 text-sm text-navy-600">{o.descricao}</p>}

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-navy-50/50 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-navy-400">Início previsto</p>
                    <p className="font-semibold text-navy-800">{formatarData(o.data_prevista_inicio)}</p>
                  </div>
                  <div>
                    <p className="text-navy-400">Conclusão prevista</p>
                    <p className="font-semibold text-navy-800">{formatarData(o.data_prevista_conclusao)}</p>
                  </div>
                  <div>
                    <p className="text-navy-400">Início real</p>
                    <p className="font-semibold text-navy-800">{formatarData(o.data_real_inicio)}</p>
                  </div>
                  <div>
                    <p className="text-navy-400">Conclusão real</p>
                    <p className="font-semibold text-navy-800">{formatarData(o.data_real_conclusao)}</p>
                  </div>
                </div>

                {o.observacoes && <p className="mt-2 text-sm text-navy-600">{o.observacoes}</p>}

                <div className="mt-3 flex flex-wrap gap-3">
                  {podeEditar && (
                    <button onClick={() => openEdit(o)} className="text-xs font-semibold text-navy-700 hover:underline">
                      Editar
                    </button>
                  )}
                  {podeExcluir && (
                    <button
                      onClick={() => handleRemove(o)}
                      disabled={removingId === o.id}
                      className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                    >
                      {removingId === o.id ? "Removendo..." : "Remover"}
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
