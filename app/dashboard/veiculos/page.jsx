"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import {
  TIPO_VEICULO_LABELS,
  COLUNAS_RELATORIO,
  gerarModeloVeiculos,
  parseVeiculosCsv,
  parseVeiculosXlsx,
} from "@/lib/veiculos";
import { baixarBlob } from "@/lib/xlsx";
import { gerarPdf, gerarDocx } from "@/lib/relatorios";

const emptyForm = {
  unidade: "",
  bloco: "",
  morador_nome: "",
  placa: "",
  modelo: "",
  cor: "",
  tipo: "carro",
  vaga: "",
  observacoes: "",
};

export default function VeiculosPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const searchParams = useSearchParams();
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";
  const [exportando, setExportando] = useState(null);
  const [veiculos, setVeiculos] = useState([]);
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
  const [gerandoModelo, setGerandoModelo] = useState(false);
  const fileInputRef = useRef(null);

  const podeCriar = temPermissao("veiculos", "criar");
  const podeEditar = temPermissao("veiculos", "editar");
  const podeExcluir = temPermissao("veiculos", "excluir");
  const podeCriarMorador = temPermissao("moradores", "criar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("veiculos")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("unidade", { ascending: true });
    if (fetchError) setError(fetchError.message);
    else setVeiculos(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Vem do atalho "+ Adicionar veículo" da tela de Moradores (unidade,
  // bloco e nome já preenchidos na URL) — pré-preenche o formulário sem
  // precisar redigitar o que já foi informado lá.
  useEffect(() => {
    const unidade = searchParams.get("unidade");
    if (!unidade) return;
    setForm((f) => ({
      ...f,
      unidade,
      bloco: searchParams.get("bloco") || f.bloco,
      morador_nome: searchParams.get("morador") || f.morador_nome,
    }));
  }, [searchParams]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!condominio?.id || !form.unidade.trim() || !form.morador_nome.trim() || !form.placa.trim()) return;

    setSubmitting(true);
    setError("");

    const payload = {
      condominio_id: condominio.id,
      unidade: form.unidade.trim(),
      bloco: form.bloco.trim() || null,
      morador_nome: form.morador_nome.trim(),
      placa: form.placa.trim().toUpperCase(),
      modelo: form.modelo.trim() || null,
      cor: form.cor.trim() || null,
      tipo: form.tipo,
      vaga: form.vaga.trim() || null,
      observacoes: form.observacoes.trim() || null,
    };

    const query = editingId
      ? supabase.from("veiculos").update(payload).eq("id", editingId)
      : supabase.from("veiculos").insert(payload);
    const { error: saveError } = await query;
    setSubmitting(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    resetForm();
    load();
  }

  function openEdit(veiculo) {
    setError("");
    setEditingId(veiculo.id);
    setForm({
      unidade: veiculo.unidade,
      bloco: veiculo.bloco || "",
      morador_nome: veiculo.morador_nome,
      placa: veiculo.placa,
      modelo: veiculo.modelo || "",
      cor: veiculo.cor || "",
      tipo: veiculo.tipo || "carro",
      vaga: veiculo.vaga || "",
      observacoes: veiculo.observacoes || "",
    });
  }

  async function handleRemove(veiculo) {
    if (!confirm(`Remover o veículo placa "${veiculo.placa}" (unidade ${veiculo.unidade}) do cadastro?`)) return;
    setRemovingId(veiculo.id);
    const { error: deleteError } = await supabase.from("veiculos").delete().eq("id", veiculo.id);
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
      reader.onload = () => setPreview(parseVeiculosCsv(String(reader.result || "")));
      reader.onerror = () => setError("Não consegui ler o arquivo. Tente novamente.");
      reader.readAsText(file, "utf-8");
    } else {
      reader.onload = async () => setPreview(await parseVeiculosXlsx(reader.result));
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

    let moradoresCriados = 0;

    // Se quem está importando também pode cadastrar moradores, aproveita e
    // já cria quem ainda não existe (por unidade + nome) — assim não
    // precisa preencher a planilha de Moradores à parte pro caso comum
    // (cada morador com até um veículo).
    if (podeCriarMorador) {
      const paresUnicos = new Map();
      for (const l of preview.linhas) {
        const chave = `${l.unidade}|||${l.morador_nome.toLowerCase()}`;
        if (!paresUnicos.has(chave)) {
          paresUnicos.set(chave, { unidade: l.unidade, bloco: l.bloco || null, nome: l.morador_nome });
        }
      }

      const unidades = [...new Set([...paresUnicos.values()].map((p) => p.unidade))];
      const { data: moradoresExistentes, error: buscaError } = await supabase
        .from("moradores")
        .select("unidade, nome")
        .eq("condominio_id", condominio.id)
        .in("unidade", unidades);

      if (buscaError) {
        setError(buscaError.message);
        setImportando(false);
        return;
      }

      const existentes = new Set(
        (moradoresExistentes || []).map((m) => `${m.unidade}|||${m.nome.toLowerCase()}`)
      );
      const moradoresParaCriar = [...paresUnicos.entries()]
        .filter(([chave]) => !existentes.has(chave))
        .map(([, p]) => ({ condominio_id: condominio.id, unidade: p.unidade, bloco: p.bloco, nome: p.nome }));

      if (moradoresParaCriar.length > 0) {
        const { error: moradoresError } = await supabase.from("moradores").insert(moradoresParaCriar);
        if (moradoresError) {
          setError(moradoresError.message);
          setImportando(false);
          return;
        }
        moradoresCriados = moradoresParaCriar.length;
      }
    }

    const payload = preview.linhas.map((l) => ({
      condominio_id: condominio.id,
      unidade: l.unidade,
      bloco: l.bloco || null,
      morador_nome: l.morador_nome,
      placa: String(l.placa || "").toUpperCase(),
      modelo: l.modelo || null,
      cor: l.cor || null,
      tipo: l.tipo || "carro",
      vaga: l.vaga || null,
    }));

    const { error: importError } = await supabase.from("veiculos").insert(payload);
    setImportando(false);

    if (importError) {
      setError(importError.message);
      return;
    }
    setImportResumo(
      `${payload.length} veículo(s) importado(s) com sucesso` +
        (moradoresCriados > 0 ? ` (${moradoresCriados} morador(es) cadastrado(s) automaticamente).` : ".")
    );
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  async function baixarModelo() {
    setGerandoModelo(true);
    try {
      const blob = await gerarModeloVeiculos();
      baixarBlob(blob, "modelo-veiculos.xlsx");
    } finally {
      setGerandoModelo(false);
    }
  }

  function montarConfigRelatorio() {
    return {
      condominioNome: condominio?.nome,
      tipoLabel: "Veículos",
      periodoLabel: "",
      filtros: busca ? [{ label: "Busca", valor: busca }] : [],
      colunas: COLUNAS_RELATORIO,
      linhas: veiculosFiltrados.map((v) => ({ ...v, tipoLabel: TIPO_VEICULO_LABELS[v.tipo] || v.tipo })),
      resumo: [{ label: "Total de veículos", valor: veiculosFiltrados.length }],
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

  const veiculosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return veiculos;
    return veiculos.filter((v) =>
      [v.unidade, v.bloco, v.morador_nome, v.placa, v.modelo, v.cor, v.vaga]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(termo))
    );
  }, [veiculos, busca]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="veiculos">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Veículos</h1>
          <p className="mt-1 text-sm text-navy-500">
            Cadastro de carros e motos de cada unidade — ajuda a portaria a conferir se uma placa
            pertence a um morador antes de liberar a entrada.
          </p>
        </div>

        <div className="card">
          <p className="text-xs text-navy-400">Total cadastrado</p>
          <p className="mt-1 font-display text-xl font-bold text-navy-900">{veiculos.length}</p>
        </div>

        {podeCriar && (
          <div className="card">
            <h2 className="font-display text-lg font-bold text-navy-900">Importar de uma planilha</h2>
            <p className="mt-1 text-sm text-navy-500">
              Baixe o modelo em Excel já formatado, preencha apartamento, morador, placa e o resto
              que quiser, e suba o arquivo de volta aqui.
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
                      Encontrei <strong>{preview.linhas.length}</strong> veículo(s) para importar. Confira antes de
                      confirmar:
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-navy-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-navy-50 text-navy-500">
                          <tr>
                            <th className="px-3 py-2">Unidade</th>
                            <th className="px-3 py-2">Morador</th>
                            <th className="px-3 py-2">Placa</th>
                            <th className="px-3 py-2">Bloco</th>
                            <th className="px-3 py-2">Modelo</th>
                            <th className="px-3 py-2">Tipo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.linhas.map((l, i) => (
                            <tr key={i} className="border-t border-navy-50">
                              <td className="px-3 py-1.5">{l.unidade}</td>
                              <td className="px-3 py-1.5">{l.morador_nome}</td>
                              <td className="px-3 py-1.5">{l.placa}</td>
                              <td className="px-3 py-1.5">{l.bloco}</td>
                              <td className="px-3 py-1.5">{l.modelo}</td>
                              <td className="px-3 py-1.5">{TIPO_VEICULO_LABELS[l.tipo] || l.tipo}</td>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-navy-900">
                {editingId ? "Editar veículo" : "Cadastrar manualmente"}
              </h2>
              {!editingId && podeCriarMorador && (
                <Link
                  href={`/dashboard/moradores?unidade=${encodeURIComponent(form.unidade)}&bloco=${encodeURIComponent(form.bloco)}`}
                  className="text-xs font-semibold text-navy-700 hover:underline"
                >
                  Morador ainda não cadastrado? + Cadastrar morador
                </Link>
              )}
            </div>
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
                <label className="label-field">Morador</label>
                <input
                  className="input-field"
                  value={form.morador_nome}
                  onChange={(e) => setForm((f) => ({ ...f, morador_nome: e.target.value }))}
                  placeholder="Nome de quem é dono do veículo"
                  required
                />
              </div>
              <div>
                <label className="label-field">Placa</label>
                <input
                  className="input-field uppercase"
                  value={form.placa}
                  onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value }))}
                  placeholder="Ex: ABC1D23"
                  required
                />
              </div>
              <div>
                <label className="label-field">Tipo</label>
                <select
                  className="input-field"
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                >
                  {Object.entries(TIPO_VEICULO_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Vaga (opcional)</label>
                <input
                  className="input-field"
                  value={form.vaga}
                  onChange={(e) => setForm((f) => ({ ...f, vaga: e.target.value }))}
                  placeholder="Ex: G-12"
                />
              </div>
              <div>
                <label className="label-field">Modelo (opcional)</label>
                <input
                  className="input-field"
                  value={form.modelo}
                  onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                  placeholder="Ex: Honda Civic"
                />
              </div>
              <div>
                <label className="label-field">Cor (opcional)</label>
                <input
                  className="input-field"
                  value={form.cor}
                  onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
                  placeholder="Ex: Prata"
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
                  {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar veículo"}
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
            placeholder="Buscar por unidade, morador, placa ou modelo..."
          />
          <button
            onClick={handleExportarPdf}
            disabled={Boolean(exportando) || veiculosFiltrados.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            {exportando === "pdf" ? "Gerando..." : "Baixar PDF"}
          </button>
          <button
            onClick={handleExportarDocx}
            disabled={Boolean(exportando) || veiculosFiltrados.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            {exportando === "docx" ? "Gerando..." : "Baixar Word"}
          </button>
        </div>

        {loading ? (
          <p className="text-navy-500">Carregando veículos...</p>
        ) : veiculosFiltrados.length === 0 ? (
          <div className="card text-center text-navy-400">
            {veiculos.length === 0 ? "Nenhum veículo cadastrado ainda." : "Nenhum veículo encontrado."}
          </div>
        ) : (
          <div className="space-y-3">
            {veiculosFiltrados.map((v) => (
              <div key={v.id} className="card">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{v.placa}</h3>
                  <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                    {TIPO_VEICULO_LABELS[v.tipo] || v.tipo}
                  </span>
                  <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                    Unidade {v.unidade}
                    {v.bloco ? ` · Bloco ${v.bloco}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-navy-400">
                  {[v.morador_nome, v.modelo, v.cor, v.vaga ? `Vaga ${v.vaga}` : null].filter(Boolean).join(" · ")}
                </p>
                {v.observacoes && <p className="mt-2 text-sm text-navy-600">{v.observacoes}</p>}
                <div className="mt-3 flex flex-wrap gap-3">
                  {podeEditar && (
                    <button onClick={() => openEdit(v)} className="text-xs font-semibold text-navy-700 hover:underline">
                      Editar
                    </button>
                  )}
                  {podeExcluir && (
                    <button
                      onClick={() => handleRemove(v)}
                      disabled={removingId === v.id}
                      className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                    >
                      {removingId === v.id ? "Removendo..." : "Remover"}
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
