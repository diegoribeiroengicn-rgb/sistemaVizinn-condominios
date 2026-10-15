"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import CapturaFoto from "@/components/CapturaFoto";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import { parseMoradoresCsv, parseMoradoresXlsx, gerarModeloMoradores, COLUNAS_RELATORIO } from "@/lib/moradores";
import { baixarBlob } from "@/lib/xlsx";
import { gerarPdf, gerarDocx } from "@/lib/relatorios";
import { DOCUMENTO_TIPO_LABELS, TIPO_VISITANTE_LABELS, enviarFotoPessoa, obterUrlFotoAssinada } from "@/lib/pessoas";

const emptyForm = {
  unidade: "",
  bloco: "",
  nome: "",
  telefone: "",
  email: "",
  documentoTipo: "",
  documentoNumero: "",
  observacoes: "",
};

const emptyFormPessoa = {
  nome: "",
  tipo: "visitante",
  documentoTipo: "cpf",
  documentoNumero: "",
  telefone: "",
  observacoes: "",
};

// Cadastro de Pessoas: uma tela com duas abas. "Moradores" é o cadastro
// que já existia (unidade/bloco, não depende de ter login). "Visitantes"
// reúne quem NÃO é morador mas vale reconhecer da próxima vez (visitante,
// entregador, prestador de serviço, outro) — são as mesmas pessoas que a
// Portaria já cria/reconhece pelo documento (ver lib/pessoas.js); aqui dá
// pra ver, editar e desativar esses cadastros, não só criar de passagem
// no balcão. Veículos continua sendo uma tela própria, de propósito.
export default function MoradoresPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const searchParams = useSearchParams();
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  const podeVerMoradores = temPermissao("moradores", "visualizar");
  const podeCriar = temPermissao("moradores", "criar");
  const podeEditar = temPermissao("moradores", "editar");
  const podeExcluir = temPermissao("moradores", "excluir");
  const podeCriarVeiculo = temPermissao("veiculos", "criar");

  // Visitantes/pessoas-da-portaria usam a mesma permissão de "portaria"
  // (não cria um módulo/permissão novo — ver RLS em supabase/schema.sql).
  const podeVerVisitantes = temPermissao("portaria", "visualizar");
  const podeCriarVisitante = temPermissao("portaria", "criar");
  const podeEditarVisitante = temPermissao("portaria", "editar");

  const [aba, setAba] = useState("moradores");
  useEffect(() => {
    if (!podeVerMoradores && podeVerVisitantes) setAba("visitantes");
  }, [podeVerMoradores, podeVerVisitantes]);

  // ---- Moradores (igual já funcionava) --------------------------------
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
  const [fotoArquivo, setFotoArquivo] = useState(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [abrindoFotoId, setAbrindoFotoId] = useState(null);

  const [preview, setPreview] = useState(null); // { linhas, erros }
  const [importando, setImportando] = useState(false);
  const [importResumo, setImportResumo] = useState("");
  const [gerandoModelo, setGerandoModelo] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    if (!condominio?.id || !podeVerMoradores) return;
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
  }, [condominio?.id, podeVerMoradores]);

  useEffect(() => {
    load();
  }, [load]);

  // Vem do atalho "+ Cadastrar morador" da tela de Veículos (unidade/bloco
  // já preenchidos na URL) — pré-preenche o formulário sem precisar
  // redigitar o que já foi informado lá.
  useEffect(() => {
    const unidade = searchParams.get("unidade");
    if (!unidade) return;
    setForm((f) => ({ ...f, unidade, bloco: searchParams.get("bloco") || f.bloco }));
  }, [searchParams]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFotoArquivo(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!condominio?.id || !form.unidade.trim() || !form.nome.trim()) return;
    if (form.documentoNumero.trim() && !form.documentoTipo) {
      setError("Escolha o tipo do documento informado.");
      return;
    }

    setSubmitting(true);
    setError("");

    // O documento identifica a pessoa e evita duplicidade — se já existe
    // um morador com esse mesmo documento (fora quem está sendo editado
    // agora), não cria outro cadastro: avisa qual já existe.
    if (form.documentoNumero.trim()) {
      let buscaDuplicado = supabase
        .from("moradores")
        .select("id, nome, unidade")
        .eq("condominio_id", condominio.id)
        .eq("documento_tipo", form.documentoTipo)
        .eq("documento_numero", form.documentoNumero.trim());
      if (editingId) buscaDuplicado = buscaDuplicado.neq("id", editingId);
      const { data: duplicado } = await buscaDuplicado.maybeSingle();
      if (duplicado) {
        setSubmitting(false);
        setError(`Esse documento já está cadastrado para "${duplicado.nome}" (unidade ${duplicado.unidade}).`);
        return;
      }
    }

    let fotoPath;
    if (fotoArquivo) {
      setEnviandoFoto(true);
      try {
        fotoPath = await enviarFotoPessoa(condominio.id, "moradores", fotoArquivo);
      } catch (uploadError) {
        setSubmitting(false);
        setEnviandoFoto(false);
        setError(`Erro ao enviar a foto: ${uploadError.message}`);
        return;
      }
      setEnviandoFoto(false);
    }

    const payload = {
      condominio_id: condominio.id,
      unidade: form.unidade.trim(),
      bloco: form.bloco.trim() || null,
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      documento_tipo: form.documentoTipo || null,
      documento_numero: form.documentoNumero.trim() || null,
      observacoes: form.observacoes.trim() || null,
      ...(fotoPath ? { foto_path: fotoPath } : {}),
      ...(editingId ? {} : { criado_por_id: user?.id || null }),
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

  async function handleVerFoto(morador) {
    if (!morador.foto_path) return;
    setAbrindoFotoId(morador.id);
    const url = await obterUrlFotoAssinada(morador.foto_path);
    setAbrindoFotoId(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setError("Não consegui abrir a foto agora. Tente de novo.");
  }

  function openEdit(morador) {
    setError("");
    setEditingId(morador.id);
    setFotoArquivo(null);
    setForm({
      unidade: morador.unidade,
      bloco: morador.bloco || "",
      nome: morador.nome,
      telefone: morador.telefone || "",
      email: morador.email || "",
      documentoTipo: morador.documento_tipo || "",
      documentoNumero: morador.documento_numero || "",
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
    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.onload = () => setPreview(parseMoradoresCsv(String(reader.result || "")));
      reader.onerror = () => setError("Não consegui ler o arquivo. Tente novamente.");
      reader.readAsText(file, "utf-8");
    } else {
      reader.onload = async () => setPreview(await parseMoradoresXlsx(reader.result));
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

  async function baixarModelo() {
    setGerandoModelo(true);
    try {
      const blob = await gerarModeloMoradores();
      baixarBlob(blob, "modelo-moradores.xlsx");
    } finally {
      setGerandoModelo(false);
    }
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

  const moradoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return moradores;
    return moradores.filter((m) =>
      [m.unidade, m.bloco, m.nome, m.telefone, m.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(termo))
    );
  }, [moradores, busca]);

  // ---- Visitantes/entregadores/prestadores/outro ----------------------
  const [pessoas, setPessoas] = useState([]);
  const [loadingPessoas, setLoadingPessoas] = useState(true);
  const [errorPessoas, setErrorPessoas] = useState("");
  const [formPessoa, setFormPessoa] = useState(emptyFormPessoa);
  const [submittingPessoa, setSubmittingPessoa] = useState(false);
  const [editingPessoaId, setEditingPessoaId] = useState(null);
  const [fotoPessoaArquivo, setFotoPessoaArquivo] = useState(null);
  const [enviandoFotoPessoa, setEnviandoFotoPessoa] = useState(false);
  const [abrindoFotoPessoaId, setAbrindoFotoPessoaId] = useState(null);
  const [alterandoSituacaoId, setAlterandoSituacaoId] = useState(null);
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [filtroTipoPessoa, setFiltroTipoPessoa] = useState("");

  const loadPessoas = useCallback(async () => {
    if (!condominio?.id || !podeVerVisitantes) return;
    setLoadingPessoas(true);
    setErrorPessoas("");
    const { data, error: fetchError } = await supabase
      .from("visitantes")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("nome", { ascending: true });
    if (fetchError) setErrorPessoas(fetchError.message);
    else setPessoas(data || []);
    setLoadingPessoas(false);
  }, [condominio?.id, podeVerVisitantes]);

  useEffect(() => {
    loadPessoas();
  }, [loadPessoas]);

  function resetFormPessoa() {
    setFormPessoa(emptyFormPessoa);
    setEditingPessoaId(null);
    setFotoPessoaArquivo(null);
  }

  function openEditPessoa(pessoa) {
    setErrorPessoas("");
    setEditingPessoaId(pessoa.id);
    setFotoPessoaArquivo(null);
    setFormPessoa({
      nome: pessoa.nome,
      tipo: pessoa.tipo || "visitante",
      documentoTipo: pessoa.documento_tipo || "cpf",
      documentoNumero: pessoa.documento_numero || "",
      telefone: pessoa.telefone || "",
      observacoes: pessoa.observacoes || "",
    });
  }

  async function handleSubmitPessoa(e) {
    e.preventDefault();
    if (!condominio?.id || !formPessoa.nome.trim()) return;

    setSubmittingPessoa(true);
    setErrorPessoas("");

    if (formPessoa.documentoNumero.trim()) {
      let buscaDuplicado = supabase
        .from("visitantes")
        .select("id, nome")
        .eq("condominio_id", condominio.id)
        .eq("documento_tipo", formPessoa.documentoTipo)
        .eq("documento_numero", formPessoa.documentoNumero.trim());
      if (editingPessoaId) buscaDuplicado = buscaDuplicado.neq("id", editingPessoaId);
      const { data: duplicado } = await buscaDuplicado.maybeSingle();
      if (duplicado) {
        setSubmittingPessoa(false);
        setErrorPessoas(`Esse documento já está cadastrado para "${duplicado.nome}".`);
        return;
      }
    }

    let fotoPath;
    if (fotoPessoaArquivo) {
      setEnviandoFotoPessoa(true);
      try {
        fotoPath = await enviarFotoPessoa(condominio.id, "visitantes", fotoPessoaArquivo);
      } catch (uploadError) {
        setSubmittingPessoa(false);
        setEnviandoFotoPessoa(false);
        setErrorPessoas(`Erro ao enviar a foto: ${uploadError.message}`);
        return;
      }
      setEnviandoFotoPessoa(false);
    }

    const payload = {
      condominio_id: condominio.id,
      nome: formPessoa.nome.trim(),
      tipo: formPessoa.tipo,
      telefone: formPessoa.telefone.trim() || null,
      documento_tipo: formPessoa.documentoNumero.trim() ? formPessoa.documentoTipo : null,
      documento_numero: formPessoa.documentoNumero.trim() || null,
      observacoes: formPessoa.observacoes.trim() || null,
      ...(fotoPath ? { foto_path: fotoPath } : {}),
      ...(editingPessoaId ? {} : { criado_por_id: user?.id || null }),
    };

    const query = editingPessoaId
      ? supabase.from("visitantes").update(payload).eq("id", editingPessoaId)
      : supabase.from("visitantes").insert(payload);
    const { error: saveError } = await query;
    setSubmittingPessoa(false);

    if (saveError) {
      setErrorPessoas(saveError.message);
      return;
    }
    resetFormPessoa();
    loadPessoas();
  }

  async function handleAlternarSituacao(pessoa) {
    const novaSituacao = pessoa.situacao === "ativo" ? "inativo" : "ativo";
    setAlterandoSituacaoId(pessoa.id);
    const { error: updateError } = await supabase
      .from("visitantes")
      .update({ situacao: novaSituacao })
      .eq("id", pessoa.id);
    setAlterandoSituacaoId(null);
    if (updateError) setErrorPessoas(updateError.message);
    else loadPessoas();
  }

  async function handleVerFotoPessoa(pessoa) {
    if (!pessoa.foto_path) return;
    setAbrindoFotoPessoaId(pessoa.id);
    const url = await obterUrlFotoAssinada(pessoa.foto_path);
    setAbrindoFotoPessoaId(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setErrorPessoas("Não consegui abrir a foto agora. Tente de novo.");
  }

  const pessoasFiltradas = useMemo(() => {
    const termo = buscaPessoa.trim().toLowerCase();
    return pessoas.filter((p) => {
      if (filtroTipoPessoa && p.tipo !== filtroTipoPessoa) return false;
      if (!termo) return true;
      return [p.nome, p.telefone, p.documento_numero].filter(Boolean).some((v) => String(v).toLowerCase().includes(termo));
    });
  }, [pessoas, buscaPessoa, filtroTipoPessoa]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  if (!podeVerMoradores && !podeVerVisitantes) {
    return (
      <div className="card text-center text-navy-500">
        Você não tem acesso a este módulo. Fale com o síndico se acha que isso é um engano.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Cadastro de Pessoas</h1>
        <p className="mt-1 text-sm text-navy-500">
          Moradores (cada unidade) e quem passa pela portaria sem morar aqui — visitante, entregador,
          prestador de serviço — reconhecido pelo documento da próxima vez que vier.
        </p>
      </div>

      {podeVerMoradores && podeVerVisitantes && (
        <nav className="flex flex-wrap gap-1">
          {[
            { id: "moradores", label: "Moradores" },
            { id: "visitantes", label: "Visitantes e outros" },
          ].map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                aba === a.id ? "bg-midnight text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"
              }`}
            >
              {a.label}
            </button>
          ))}
        </nav>
      )}

      {aba === "moradores" && podeVerMoradores && (
        <div className="space-y-6">
          <div className="card">
            <p className="text-xs text-navy-400">Total cadastrado</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{moradores.length}</p>
          </div>

          {podeCriar && (
            <div className="card">
              <h2 className="font-display text-lg font-bold text-navy-900">Importar de uma planilha</h2>
              <p className="mt-1 text-sm text-navy-500">
                Baixe o modelo em Excel já formatado, preencha apartamento, nome, bloco e telefone
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
                {editingId ? "Editar morador" : "Cadastrar manualmente"}
              </h2>
              <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-field">Unidade</label>
                  <input
                    className="input-field"
                    inputMode="numeric"
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
                <div>
                  <label className="label-field">Tipo de documento (opcional)</label>
                  <select
                    className="input-field"
                    value={form.documentoTipo}
                    onChange={(e) => setForm((f) => ({ ...f, documentoTipo: e.target.value }))}
                  >
                    <option value="">Não informar</option>
                    {Object.entries(DOCUMENTO_TIPO_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Número do documento (opcional)</label>
                  <input
                    className="input-field"
                    value={form.documentoNumero}
                    onChange={(e) => setForm((f) => ({ ...f, documentoNumero: e.target.value }))}
                    placeholder="Usado pela portaria pra reconhecer essa pessoa"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Foto (opcional)</label>
                  <CapturaFoto onCapturar={setFotoArquivo} fotoAtualNome={editingId ? "foto atual" : null} />
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
                    {enviandoFoto ? "Enviando foto..." : submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar morador"}
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
                  <p className="mt-1 text-xs text-navy-400">
                    {[m.telefone, m.email, m.documento_numero ? `${DOCUMENTO_TIPO_LABELS[m.documento_tipo] || "Doc."}: ${m.documento_numero}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {m.observacoes && <p className="mt-2 text-sm text-navy-600">{m.observacoes}</p>}
                  <div className="mt-3 flex flex-wrap gap-3">
                    {podeEditar && (
                      <button onClick={() => openEdit(m)} className="text-xs font-semibold text-navy-700 hover:underline">
                        Editar
                      </button>
                    )}
                    {m.foto_path && (
                      <button
                        onClick={() => handleVerFoto(m)}
                        disabled={abrindoFotoId === m.id}
                        className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50"
                      >
                        {abrindoFotoId === m.id ? "Abrindo..." : "Ver foto"}
                      </button>
                    )}
                    {podeCriarVeiculo && (
                      <Link
                        href={`/dashboard/veiculos?unidade=${encodeURIComponent(m.unidade)}&bloco=${encodeURIComponent(m.bloco || "")}&morador=${encodeURIComponent(m.nome)}`}
                        className="text-xs font-semibold text-navy-700 hover:underline"
                      >
                        + Adicionar veículo
                      </Link>
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
      )}

      {aba === "visitantes" && podeVerVisitantes && (
        <div className="space-y-6">
          <div className="card">
            <p className="text-xs text-navy-400">Total cadastrado</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{pessoas.length}</p>
          </div>

          {podeCriarVisitante && (
            <div className="card">
              <h2 className="font-display text-lg font-bold text-navy-900">
                {editingPessoaId ? "Editar cadastro" : "Cadastrar manualmente"}
              </h2>
              <p className="mt-1 text-sm text-navy-500">
                O mesmo cadastro que a Portaria cria sozinha quando busca por documento e não acha
                ninguém — aqui dá pra criar, corrigir ou desativar direto.
              </p>
              <form onSubmit={handleSubmitPessoa} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-field">Nome completo</label>
                  <input
                    className="input-field"
                    value={formPessoa.nome}
                    onChange={(e) => setFormPessoa((f) => ({ ...f, nome: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Tipo</label>
                  <select
                    className="input-field"
                    value={formPessoa.tipo}
                    onChange={(e) => setFormPessoa((f) => ({ ...f, tipo: e.target.value }))}
                  >
                    {Object.entries(TIPO_VISITANTE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Telefone (opcional)</label>
                  <input
                    className="input-field"
                    value={formPessoa.telefone}
                    onChange={(e) => setFormPessoa((f) => ({ ...f, telefone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Tipo de documento (opcional)</label>
                  <select
                    className="input-field"
                    value={formPessoa.documentoTipo}
                    onChange={(e) => setFormPessoa((f) => ({ ...f, documentoTipo: e.target.value }))}
                  >
                    {Object.entries(DOCUMENTO_TIPO_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Número do documento (opcional)</label>
                  <input
                    className="input-field"
                    value={formPessoa.documentoNumero}
                    onChange={(e) => setFormPessoa((f) => ({ ...f, documentoNumero: e.target.value }))}
                    placeholder="Usado pra reconhecer da próxima vez"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Foto (opcional)</label>
                  <CapturaFoto onCapturar={setFotoPessoaArquivo} fotoAtualNome={editingPessoaId ? "foto atual" : null} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Observações (opcional)</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={formPessoa.observacoes}
                    onChange={(e) => setFormPessoa((f) => ({ ...f, observacoes: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2 flex gap-3">
                  <button type="submit" disabled={submittingPessoa} className="btn-primary">
                    {enviandoFotoPessoa
                      ? "Enviando foto..."
                      : submittingPessoa
                        ? "Salvando..."
                        : editingPessoaId
                          ? "Salvar alterações"
                          : "Cadastrar"}
                  </button>
                  {editingPessoaId && (
                    <button type="button" onClick={resetFormPessoa} className="text-sm font-semibold text-navy-500 hover:underline">
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {errorPessoas && <p className="text-sm text-coral-700">{errorPessoas}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input-field flex-1"
              value={buscaPessoa}
              onChange={(e) => setBuscaPessoa(e.target.value)}
              placeholder="Buscar por nome, telefone ou documento..."
            />
            <select
              className="input-field"
              value={filtroTipoPessoa}
              onChange={(e) => setFiltroTipoPessoa(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(TIPO_VISITANTE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {loadingPessoas ? (
            <p className="text-navy-500">Carregando...</p>
          ) : pessoasFiltradas.length === 0 ? (
            <div className="card text-center text-navy-400">
              {pessoas.length === 0 ? "Ninguém cadastrado ainda." : "Nenhum registro encontrado."}
            </div>
          ) : (
            <div className="space-y-3">
              {pessoasFiltradas.map((p) => (
                <div key={p.id} className="card">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-navy-900">{p.nome}</h3>
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                      {TIPO_VISITANTE_LABELS[p.tipo] || p.tipo}
                    </span>
                    {p.situacao === "inativo" && (
                      <span className="rounded-full bg-coral/10 px-2 py-0.5 text-xs font-medium text-coral-700">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-navy-400">
                    {[
                      p.telefone,
                      p.documento_numero ? `${DOCUMENTO_TIPO_LABELS[p.documento_tipo] || "Doc."}: ${p.documento_numero}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {p.observacoes && <p className="mt-2 text-sm text-navy-600">{p.observacoes}</p>}
                  <div className="mt-3 flex flex-wrap gap-3">
                    {podeEditarVisitante && (
                      <button onClick={() => openEditPessoa(p)} className="text-xs font-semibold text-navy-700 hover:underline">
                        Editar
                      </button>
                    )}
                    {p.foto_path && (
                      <button
                        onClick={() => handleVerFotoPessoa(p)}
                        disabled={abrindoFotoPessoaId === p.id}
                        className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50"
                      >
                        {abrindoFotoPessoaId === p.id ? "Abrindo..." : "Ver foto"}
                      </button>
                    )}
                    {podeEditarVisitante && (
                      <button
                        onClick={() => handleAlternarSituacao(p)}
                        disabled={alterandoSituacaoId === p.id}
                        className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                      >
                        {alterandoSituacaoId === p.id ? "..." : p.situacao === "ativo" ? "Desativar" : "Reativar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
