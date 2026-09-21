"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import {
  CATEGORIAS_SUGERIDAS,
  CRITERIOS_AVALIACAO,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_STYLES,
  TIPO_LABELS,
  calcularNotaMedia,
  parseFornecedoresCsv,
  parseFornecedoresXlsx,
  gerarModeloFornecedores,
  COLUNAS_RELATORIO,
  buscarOuCriarFornecedorGlobal,
} from "@/lib/fornecedores";
import { formatarMoeda } from "@/lib/financeiro";
import { baixarBlob } from "@/lib/xlsx";
import { gerarPdf, gerarDocx } from "@/lib/relatorios";
import { apenasDigitos, validarCnpj, formatarCnpj, formatarCpf } from "@/lib/validacaoDocumentos";

const emptyForm = {
  razaoSocial: "",
  nomeFantasia: "",
  documento: "",
  tipo: "empresa",
  categoria: "",
  telefone: "",
  whatsapp: "",
  email: "",
  endereco: "",
  site: "",
  contatoPrincipal: "",
  vendedorNome: "",
  vendedorContato: "",
  observacoes: "",
  status: "ativo",
};

const emptyAvaliacao = { nota_qualidade: 5, nota_prazo: 5, nota_custo: 5, nota_atendimento: 5, observacao: "" };

function Estrelas({ nota, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={n <= nota ? "text-amber-500" : "text-navy-200"}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function FornecedoresPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const [fornecedores, setFornecedores] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [avaliandoId, setAvaliandoId] = useState(null);
  const [avaliacaoForm, setAvaliacaoForm] = useState(emptyAvaliacao);
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");

  const [preview, setPreview] = useState(null); // { linhas, erros }
  const [importando, setImportando] = useState(false);
  const [importResumo, setImportResumo] = useState("");
  const [gerandoModelo, setGerandoModelo] = useState(false);
  const [exportando, setExportando] = useState(null);
  const fileInputRef = useRef(null);

  const podeCriar = temPermissao("fornecedores", "criar");
  const podeEditar = temPermissao("fornecedores", "editar");
  const podeExcluir = temPermissao("fornecedores", "excluir");
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const [fResult, aResult, mResult, cResult] = await Promise.all([
      supabase
        .from("fornecedores")
        .select("*")
        .eq("condominio_id", condominio.id)
        .order("razao_social", { ascending: true }),
      supabase.from("avaliacoes_fornecedor").select("*").eq("condominio_id", condominio.id),
      supabase
        .from("manutencoes")
        .select("id, titulo, status, fornecedor_id, concluido_em, created_at")
        .eq("condominio_id", condominio.id)
        .not("fornecedor_id", "is", null),
      temPermissao("financeiro", "visualizar")
        ? supabase
            .from("contas_pagar")
            .select("id, valor, fornecedor_id, data_pagamento, status")
            .eq("condominio_id", condominio.id)
            .not("fornecedor_id", "is", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (fResult.error) setError(fResult.error.message);
    else setFornecedores(fResult.data || []);
    if (!aResult.error) setAvaliacoes(aResult.data || []);
    if (!mResult.error) setManutencoes(mResult.data || []);
    if (!cResult.error) setContasPagar(cResult.data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!condominio?.id || !form.razaoSocial.trim()) return;

    // CNPJ é a identidade que liga o fornecedor à base Vizinn (ver
    // lib/fornecedores.js) — só valida quando parece CNPJ (14 dígitos);
    // CPF de profissional autônomo ou campo em branco não passa por
    // aqui, e não entra na rede compartilhada.
    const digitosDocumento = apenasDigitos(form.documento);
    if (form.tipo === "empresa" && digitosDocumento.length === 14 && !validarCnpj(digitosDocumento)) {
      setError("CNPJ inválido. Confira os números digitados.");
      return;
    }

    setSubmitting(true);
    setError("");

    let fornecedorGlobalId = null;
    if (digitosDocumento.length === 14) {
      const resultado = await buscarOuCriarFornecedorGlobal(supabase, digitosDocumento, {
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        endereco: form.endereco.trim(),
        categoria: form.categoria.trim(),
      });
      if (resultado.erro) {
        setSubmitting(false);
        setError(`Erro ao vincular à base Vizinn: ${resultado.erro}`);
        return;
      }
      fornecedorGlobalId = resultado.id;
    }

    const payload = {
      condominio_id: condominio.id,
      razao_social: form.razaoSocial.trim(),
      nome_fantasia: form.nomeFantasia.trim() || null,
      documento: form.documento.trim() || null,
      tipo: form.tipo,
      categoria: form.categoria.trim() || null,
      telefone: form.telefone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      endereco: form.endereco.trim() || null,
      site: form.site.trim() || null,
      contato_principal: form.contatoPrincipal.trim() || null,
      vendedor_nome: form.vendedorNome.trim() || null,
      vendedor_contato: form.vendedorContato.trim() || null,
      observacoes: form.observacoes.trim() || null,
      status: form.status,
      fornecedor_global_id: fornecedorGlobalId,
    };

    const query = editingId
      ? supabase.from("fornecedores").update(payload).eq("id", editingId)
      : supabase.from("fornecedores").insert(payload);
    const { error: saveError } = await query;
    setSubmitting(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    resetForm();
    load();
  }

  function openEdit(fornecedor) {
    setError("");
    setEditingId(fornecedor.id);
    setForm({
      razaoSocial: fornecedor.razao_social,
      nomeFantasia: fornecedor.nome_fantasia || "",
      documento: fornecedor.documento || "",
      tipo: fornecedor.tipo,
      categoria: fornecedor.categoria || "",
      telefone: fornecedor.telefone || "",
      whatsapp: fornecedor.whatsapp || "",
      email: fornecedor.email || "",
      endereco: fornecedor.endereco || "",
      site: fornecedor.site || "",
      contatoPrincipal: fornecedor.contato_principal || "",
      vendedorNome: fornecedor.vendedor_nome || "",
      vendedorContato: fornecedor.vendedor_contato || "",
      observacoes: fornecedor.observacoes || "",
      status: fornecedor.status,
    });
  }

  async function handleRemove(fornecedor) {
    if (!confirm(`Remover o fornecedor "${fornecedor.razao_social}"?`)) return;
    setRemovingId(fornecedor.id);
    const { error: deleteError } = await supabase.from("fornecedores").delete().eq("id", fornecedor.id);
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
      reader.onload = () => setPreview(parseFornecedoresCsv(String(reader.result || "")));
      reader.onerror = () => setError("Não consegui ler o arquivo. Tente novamente.");
      reader.readAsText(file, "utf-8");
    } else {
      reader.onload = async () => setPreview(await parseFornecedoresXlsx(reader.result));
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
      razao_social: l.nome,
      telefone: l.telefone || null,
      vendedor_nome: l.vendedor || null,
      vendedor_contato: l.vendedorContato || null,
      documento: l.cnpj || null,
      categoria: l.atividade || null,
      tipo: "empresa",
      status: "ativo",
    }));

    const { error: importError } = await supabase.from("fornecedores").insert(payload);
    setImportando(false);

    if (importError) {
      setError(importError.message);
      return;
    }
    setImportResumo(`${payload.length} fornecedor(es) importado(s) com sucesso.`);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  async function baixarModelo() {
    setGerandoModelo(true);
    try {
      const blob = await gerarModeloFornecedores();
      baixarBlob(blob, "modelo-fornecedores.xlsx");
    } finally {
      setGerandoModelo(false);
    }
  }

  function montarConfigRelatorio() {
    return {
      condominioNome: condominio?.nome,
      tipoLabel: "Fornecedores",
      periodoLabel: "",
      filtros: [
        ...(filtroStatus ? [{ label: "Status", valor: STATUS_LABELS[filtroStatus] }] : []),
        ...(busca ? [{ label: "Busca", valor: busca }] : []),
      ],
      colunas: COLUNAS_RELATORIO,
      linhas: fornecedoresFiltrados.map((f) => ({ ...f, statusLabel: STATUS_LABELS[f.status] })),
      resumo: [{ label: "Total de fornecedores", valor: fornecedoresFiltrados.length }],
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

  async function handleEnviarAvaliacao(fornecedor) {
    setEnviandoAvaliacao(true);
    setError("");
    const { error: insertError } = await supabase.from("avaliacoes_fornecedor").insert({
      condominio_id: condominio.id,
      fornecedor_id: fornecedor.id,
      avaliador_id: user?.id || null,
      avaliador_nome: nomeUsuario,
      nota_qualidade: avaliacaoForm.nota_qualidade,
      nota_prazo: avaliacaoForm.nota_prazo,
      nota_custo: avaliacaoForm.nota_custo,
      nota_atendimento: avaliacaoForm.nota_atendimento,
      observacao: avaliacaoForm.observacao.trim() || null,
    });
    setEnviandoAvaliacao(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setAvaliandoId(null);
    setAvaliacaoForm(emptyAvaliacao);
    load();
  }

  const historicoPorFornecedor = useMemo(() => {
    const mapa = {};
    for (const f of fornecedores) {
      const servicos = manutencoes.filter((m) => m.fornecedor_id === f.id);
      const contas = contasPagar.filter((c) => c.fornecedor_id === f.id && c.status === "pago");
      const valorTotal = contas.reduce((soma, c) => soma + Number(c.valor || 0), 0);
      const ultimaData = servicos
        .map((s) => s.concluido_em || s.created_at)
        .filter(Boolean)
        .sort()
        .at(-1);
      const avaliacoesDoFornecedor = avaliacoes.filter((a) => a.fornecedor_id === f.id);
      mapa[f.id] = {
        qtdServicos: servicos.length,
        valorTotal,
        ultimaData,
        notaMedia: calcularNotaMedia(avaliacoesDoFornecedor),
        qtdAvaliacoes: avaliacoesDoFornecedor.length,
      };
    }
    return mapa;
  }, [fornecedores, manutencoes, contasPagar, avaliacoes]);

  // Ranking simples: quem tem nota média entra ordenado do melhor pro
  // pior; quem ainda não tem avaliação nenhuma fica no fim, em ordem
  // alfabética. Sem algoritmo de peso/complexidade — só a média mesmo.
  const fornecedoresFiltrados = useMemo(() => {
    let lista = filtroStatus ? fornecedores.filter((f) => f.status === filtroStatus) : fornecedores;
    const termo = busca.trim().toLowerCase();
    if (termo) {
      lista = lista.filter((f) =>
        [f.razao_social, f.nome_fantasia, f.documento, f.categoria, f.vendedor_nome]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(termo))
      );
    }
    return [...lista].sort((a, b) => {
      const notaA = historicoPorFornecedor[a.id]?.notaMedia;
      const notaB = historicoPorFornecedor[b.id]?.notaMedia;
      if (notaA == null && notaB == null) return a.razao_social.localeCompare(b.razao_social);
      if (notaA == null) return 1;
      if (notaB == null) return -1;
      return notaB - notaA;
    });
  }, [fornecedores, filtroStatus, busca, historicoPorFornecedor]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="fornecedores">
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Fornecedores</h1>
        <p className="mt-1 text-sm text-navy-500">
          Cadastro único de empresas e profissionais que prestam serviço pro condomínio. Ao
          concluir uma manutenção, a avaliação é pedida na hora e entra automaticamente no
          ranking abaixo (ordenado do melhor pro pior).
        </p>
      </div>

      {podeCriar && (
        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-900">Importar de uma planilha</h2>
          <p className="mt-1 text-sm text-navy-500">
            Baixe o modelo em Excel já formatado, preencha nome, telefone, vendedor, contato do
            vendedor, CNPJ e atividade da empresa, e suba o arquivo de volta aqui.
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
                    Encontrei <strong>{preview.linhas.length}</strong> fornecedor(es) para importar. Confira antes
                    de confirmar:
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-navy-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-navy-50 text-navy-500">
                        <tr>
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Telefone</th>
                          <th className="px-3 py-2">Vendedor</th>
                          <th className="px-3 py-2">Contato do vendedor</th>
                          <th className="px-3 py-2">CNPJ</th>
                          <th className="px-3 py-2">Atividade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.linhas.map((l, i) => (
                          <tr key={i} className="border-t border-navy-50">
                            <td className="px-3 py-1.5">{l.nome}</td>
                            <td className="px-3 py-1.5">{l.telefone}</td>
                            <td className="px-3 py-1.5">{l.vendedor}</td>
                            <td className="px-3 py-1.5">{l.vendedorContato}</td>
                            <td className="px-3 py-1.5">{l.cnpj}</td>
                            <td className="px-3 py-1.5">{l.atividade}</td>
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
            {editingId ? "Editar fornecedor" : "Novo fornecedor"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field">Razão social</label>
              <input
                className="input-field"
                value={form.razaoSocial}
                onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label-field">Nome fantasia (opcional)</label>
              <input
                className="input-field"
                value={form.nomeFantasia}
                onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">CNPJ/CPF (opcional)</label>
              <input
                className="input-field"
                value={form.documento}
                onChange={(e) => {
                  const formatado = form.tipo === "empresa" ? formatarCnpj(e.target.value) : formatarCpf(e.target.value);
                  setForm((f) => ({ ...f, documento: formatado }));
                }}
                placeholder={form.tipo === "empresa" ? "00.000.000/0000-00" : "000.000.000-00"}
              />
            </div>
            <div>
              <label className="label-field">Tipo</label>
              <select
                className="input-field"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                <option value="empresa">{TIPO_LABELS.empresa}</option>
                <option value="profissional">{TIPO_LABELS.profissional}</option>
              </select>
            </div>
            <div>
              <label className="label-field">Categoria (opcional)</label>
              <input
                className="input-field"
                list="categorias-fornecedor"
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              />
              <datalist id="categorias-fornecedor">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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
              <label className="label-field">Telefone (opcional)</label>
              <input
                className="input-field"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">WhatsApp (opcional)</label>
              <input
                className="input-field"
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
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
              <label className="label-field">Site (opcional)</label>
              <input
                className="input-field"
                value={form.site}
                onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">Endereço (opcional)</label>
              <input
                className="input-field"
                value={form.endereco}
                onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">Contato principal (opcional)</label>
              <input
                className="input-field"
                value={form.contatoPrincipal}
                onChange={(e) => setForm((f) => ({ ...f, contatoPrincipal: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">Vendedor da empresa (opcional)</label>
              <input
                className="input-field"
                value={form.vendedorNome}
                onChange={(e) => setForm((f) => ({ ...f, vendedorNome: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">Contato do vendedor (opcional)</label>
              <input
                className="input-field"
                value={form.vendedorContato}
                onChange={(e) => setForm((f) => ({ ...f, vendedorContato: e.target.value }))}
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
                {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar fornecedor"}
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
          placeholder="Buscar por nome, documento, categoria ou vendedor..."
        />
        <button
          onClick={handleExportarPdf}
          disabled={Boolean(exportando) || fornecedoresFiltrados.length === 0}
          className="btn-secondary disabled:opacity-50"
        >
          {exportando === "pdf" ? "Gerando..." : "Baixar PDF"}
        </button>
        <button
          onClick={handleExportarDocx}
          disabled={Boolean(exportando) || fornecedoresFiltrados.length === 0}
          className="btn-secondary disabled:opacity-50"
        >
          {exportando === "docx" ? "Gerando..." : "Baixar Word"}
        </button>
      </div>

      {loading ? (
        <p className="text-navy-500">Carregando fornecedores...</p>
      ) : fornecedoresFiltrados.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum fornecedor cadastrado ainda.</div>
      ) : (
        <div className="space-y-3">
          {fornecedoresFiltrados.map((f, index) => {
            const hist = historicoPorFornecedor[f.id] || {};
            const posicaoRanking = hist.notaMedia != null ? index + 1 : null;
            return (
              <div key={f.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {posicaoRanking && (
                        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-midnight text-xs font-bold text-white">
                          {posicaoRanking}
                        </span>
                      )}
                      <h3 className="font-semibold text-navy-900">{f.razao_social}</h3>
                      {f.nome_fantasia && <span className="text-sm text-navy-500">({f.nome_fantasia})</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[f.status]}`}>
                        {STATUS_LABELS[f.status]}
                      </span>
                      <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                        {TIPO_LABELS[f.tipo]}
                      </span>
                      {f.fornecedor_global_id && (
                        <span
                          className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
                          title="Esse CNPJ já está na base compartilhada da Vizinn"
                        >
                          🌐 Rede Vizinn
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-navy-400">
                      {[f.categoria, f.documento, f.telefone, f.whatsapp, f.email].filter(Boolean).join(" · ")}
                    </p>
                    {(f.vendedor_nome || f.vendedor_contato) && (
                      <p className="mt-1 text-xs text-navy-400">
                        Vendedor: {[f.vendedor_nome, f.vendedor_contato].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                {f.observacoes && <p className="mt-2 text-sm text-navy-600">{f.observacoes}</p>}

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-navy-50/50 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-navy-400">Serviços</p>
                    <p className="font-semibold text-navy-800">{hist.qtdServicos || 0}</p>
                  </div>
                  <div>
                    <p className="text-navy-400">Valor contratado</p>
                    <p className="font-semibold text-navy-800">{formatarMoeda(hist.valorTotal || 0)}</p>
                  </div>
                  <div>
                    <p className="text-navy-400">Última contratação</p>
                    <p className="font-semibold text-navy-800">
                      {hist.ultimaData ? new Date(hist.ultimaData).toLocaleDateString("pt-BR") : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-navy-400">Avaliação</p>
                    {hist.notaMedia != null ? (
                      <p className="font-semibold text-navy-800">
                        {hist.notaMedia.toFixed(1)} ★ ({hist.qtdAvaliacoes})
                      </p>
                    ) : (
                      <p className="text-navy-400">Dados insuficientes para avaliação</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  {podeEditar && (
                    <>
                      <button onClick={() => openEdit(f)} className="text-xs font-semibold text-navy-700 hover:underline">
                        Editar
                      </button>
                      {avaliandoId !== f.id && (
                        <button
                          onClick={() => {
                            setAvaliandoId(f.id);
                            setAvaliacaoForm(emptyAvaliacao);
                          }}
                          className="text-xs font-semibold text-navy-700 hover:underline"
                        >
                          Avaliar
                        </button>
                      )}
                    </>
                  )}
                  {podeExcluir && (
                    <button
                      onClick={() => handleRemove(f)}
                      disabled={removingId === f.id}
                      className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                    >
                      {removingId === f.id ? "Removendo..." : "Remover"}
                    </button>
                  )}
                </div>

                {avaliandoId === f.id && (
                  <div className="mt-3 space-y-2 rounded-xl border border-navy-100 p-3">
                    {CRITERIOS_AVALIACAO.map((c) => (
                      <div key={c.chave} className="flex items-center justify-between">
                        <span className="text-sm text-navy-600">{c.label}</span>
                        <Estrelas
                          nota={avaliacaoForm[c.chave]}
                          onChange={(nota) => setAvaliacaoForm((f2) => ({ ...f2, [c.chave]: nota }))}
                        />
                      </div>
                    ))}
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Observação (opcional)"
                      value={avaliacaoForm.observacao}
                      onChange={(e) => setAvaliacaoForm((f2) => ({ ...f2, observacao: e.target.value }))}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEnviarAvaliacao(f)}
                        disabled={enviandoAvaliacao}
                        className="btn-primary text-sm"
                      >
                        {enviandoAvaliacao ? "Enviando..." : "Enviar avaliação"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvaliandoId(null)}
                        className="text-sm font-semibold text-navy-500 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </ModuloGuard>
  );
}
