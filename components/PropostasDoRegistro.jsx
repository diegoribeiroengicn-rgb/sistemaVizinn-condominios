"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { STATUS_LABELS, STATUS_STYLES, STATUS_DECISAO } from "@/lib/propostas";
import { formatarMoeda } from "@/lib/financeiro";
import { nomeArquivoSeguro } from "@/lib/storage";

const emptyForm = {
  titulo: "",
  descricao: "",
  valor: "",
  dataProposta: "",
  fornecedorId: "",
  comentario: "",
};

const TAMANHO_MAXIMO_ANEXO = 15 * 1024 * 1024; // 15 MB — documento/planilha/imagem de proposta, não precisa de mais

// Painel de propostas embutido num registro de Manutenção ou de Obras e
// Melhorias — não existe mais uma página própria de Propostas (ver nota
// em lib/permissoes.js). `tipo` é "manutencao" ou "obra"; `registroId` é
// o id da manutenção/obra a que as propostas pertencem.
export default function PropostasDoRegistro({ tipo, registroId, condominioId }) {
  const { temPermissao } = useAuth();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [propostas, setPropostas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [enviandoAnexoId, setEnviandoAnexoId] = useState(null);
  const [abrindoAnexoId, setAbrindoAnexoId] = useState(null);

  const podeVisualizar = temPermissao("propostas", "visualizar");
  const podeCriar = temPermissao("propostas", "criar");
  const podeEditar = temPermissao("propostas", "editar");
  const podeAprovar = temPermissao("propostas", "aprovar");
  const podeGerarContaPagar = temPermissao("financeiro", "criar");
  const colunaOrigem = tipo === "obra" ? "obra_origem_id" : "manutencao_origem_id";

  const load = useCallback(async () => {
    if (!condominioId || !registroId) return;
    setLoading(true);
    setError("");
    const [propostasResult, fornecedoresResult] = await Promise.all([
      supabase
        .from("propostas")
        .select("*")
        .eq("condominio_id", condominioId)
        .eq(colunaOrigem, registroId)
        .order("created_at", { ascending: false }),
      temPermissao("fornecedores", "visualizar")
        ? supabase.from("fornecedores").select("id, razao_social").eq("condominio_id", condominioId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (propostasResult.error) setError(propostasResult.error.message);
    else setPropostas(propostasResult.data || []);
    if (!fornecedoresResult.error) setFornecedores(fornecedoresResult.data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId, registroId, colunaOrigem]);

  useEffect(() => {
    if (aberto) load();
  }, [aberto, load]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMostrarForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSubmitting(true);
    setError("");

    const fornecedor = fornecedores.find((f) => f.id === form.fornecedorId);
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      valor: form.valor ? Number(form.valor) : null,
      data_proposta: form.dataProposta || null,
      fornecedor_id: form.fornecedorId || null,
      fornecedor_nome: fornecedor?.razao_social || null,
      comentario: form.comentario.trim() || null,
    };

    const query = editingId
      ? supabase.from("propostas").update(payload).eq("id", editingId)
      : supabase.from("propostas").insert({
          ...payload,
          condominio_id: condominioId,
          [colunaOrigem]: registroId,
          status: "recebida",
        });
    const { error: saveError } = await query;
    setSubmitting(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    resetForm();
    load();
  }

  function openEdit(proposta) {
    setError("");
    setEditingId(proposta.id);
    setMostrarForm(true);
    setForm({
      titulo: proposta.titulo,
      descricao: proposta.descricao || "",
      valor: proposta.valor ?? "",
      dataProposta: proposta.data_proposta || "",
      fornecedorId: proposta.fornecedor_id || "",
      comentario: proposta.comentario || "",
    });
  }

  async function handleStatus(proposta, status) {
    const { error: updateError } = await supabase.from("propostas").update({ status }).eq("id", proposta.id);
    if (updateError) setError(updateError.message);
    else load();
  }

  async function handleAnexoSelecionado(proposta, file) {
    if (!file) return;
    if (file.size > TAMANHO_MAXIMO_ANEXO) {
      setError("Arquivo maior que 15 MB — não é permitido anexar.");
      return;
    }
    setEnviandoAnexoId(proposta.id);
    setError("");

    if (proposta.anexo_url) {
      await supabase.storage.from("propostas-anexos").remove([proposta.anexo_url]);
    }
    const caminho = `${condominioId}/${proposta.id}/${Date.now()}-${nomeArquivoSeguro(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("propostas-anexos").upload(caminho, file);
    if (uploadError) {
      setEnviandoAnexoId(null);
      setError(`Erro ao enviar anexo: ${uploadError.message}`);
      return;
    }
    const { error: updateError } = await supabase
      .from("propostas")
      .update({ anexo_url: caminho, anexo_nome: file.name })
      .eq("id", proposta.id);
    setEnviandoAnexoId(null);
    if (updateError) setError(updateError.message);
    else load();
  }

  async function handleVerAnexo(proposta) {
    if (!proposta.anexo_url) return;
    setAbrindoAnexoId(proposta.id);
    setError("");
    const { data, error: urlError } = await supabase.storage
      .from("propostas-anexos")
      .createSignedUrl(proposta.anexo_url, 60);
    setAbrindoAnexoId(null);
    if (urlError) {
      setError(`Erro ao abrir anexo: ${urlError.message}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleRemoverAnexo(proposta) {
    if (!proposta.anexo_url) return;
    if (!confirm(`Remover o anexo "${proposta.anexo_nome}"?`)) return;
    setError("");
    await supabase.storage.from("propostas-anexos").remove([proposta.anexo_url]);
    const { error: updateError } = await supabase
      .from("propostas")
      .update({ anexo_url: null, anexo_nome: null })
      .eq("id", proposta.id);
    if (updateError) setError(updateError.message);
    else load();
  }

  function gerarContaPagar(proposta) {
    const params = new URLSearchParams({
      aba: "pagar",
      propostaId: proposta.id,
      descricao: proposta.titulo,
      valor: proposta.valor != null ? String(proposta.valor) : "",
    });
    router.push(`/dashboard/financeiro?${params.toString()}`);
  }

  if (!podeVisualizar) return null;

  return (
    <div className="mt-3 border-t border-navy-100 pt-3">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-xs font-semibold text-navy-700 hover:underline"
      >
        {aberto ? "▾" : "▸"} Propostas{propostas.length > 0 && aberto ? ` (${propostas.length})` : ""}
      </button>

      {aberto && (
        <div className="mt-3 space-y-3">
          {error && <p className="text-xs text-coral-700">{error}</p>}

          {loading ? (
            <p className="text-xs text-navy-400">Carregando propostas...</p>
          ) : (
            <>
              {propostas.length === 0 && <p className="text-xs text-navy-400">Nenhuma proposta recebida ainda.</p>}

              {propostas.map((p) => (
                <div key={p.id} className="rounded-lg border border-navy-100 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-navy-900">{p.titulo}</h4>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-navy-400">
                        {[p.fornecedor_nome, p.valor != null && formatarMoeda(p.valor), p.data_proposta && new Date(`${p.data_proposta}T00:00:00`).toLocaleDateString("pt-BR")]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {p.descricao && <p className="mt-1 text-xs text-navy-600">{p.descricao}</p>}
                      {p.comentario && <p className="mt-1 text-xs text-navy-500">Observação: {p.comentario}</p>}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {p.anexo_nome ? (
                      <>
                        <button
                          onClick={() => handleVerAnexo(p)}
                          disabled={abrindoAnexoId === p.id}
                          className="font-semibold text-navy-700 hover:underline disabled:opacity-50"
                        >
                          📎 {p.anexo_nome}
                        </button>
                        {podeEditar && (
                          <button onClick={() => handleRemoverAnexo(p)} className="text-coral hover:underline">
                            remover
                          </button>
                        )}
                      </>
                    ) : (
                      podeEditar && <span className="text-navy-400">Sem anexo</span>
                    )}
                    {podeEditar && (
                      <label className="cursor-pointer font-semibold text-navy-700 hover:underline">
                        {enviandoAnexoId === p.id ? "Enviando..." : p.anexo_nome ? "Substituir arquivo" : "Anexar arquivo"}
                        <input
                          type="file"
                          className="hidden"
                          disabled={enviandoAnexoId === p.id}
                          onChange={(e) => handleAnexoSelecionado(p, e.target.files?.[0])}
                        />
                      </label>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {podeEditar && !STATUS_DECISAO.includes(p.status) && (
                      <>
                        <button onClick={() => openEdit(p)} className="font-semibold text-navy-700 hover:underline">
                          Editar
                        </button>
                        {p.status === "recebida" && (
                          <button onClick={() => handleStatus(p, "em_analise")} className="font-semibold text-navy-700 hover:underline">
                            Marcar como em análise
                          </button>
                        )}
                      </>
                    )}
                    {podeAprovar && !STATUS_DECISAO.includes(p.status) && (
                      <>
                        <button onClick={() => handleStatus(p, "aprovada")} className="font-semibold text-emerald-700 hover:underline">
                          Aprovar
                        </button>
                        <button onClick={() => handleStatus(p, "rejeitada")} className="font-semibold text-coral hover:underline">
                          Rejeitar
                        </button>
                      </>
                    )}
                    {p.status === "aprovada" && podeGerarContaPagar && (
                      <button onClick={() => gerarContaPagar(p)} className="font-semibold text-navy-700 hover:underline">
                        Gerar conta a pagar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {podeCriar && !mostrarForm && (
            <button type="button" onClick={() => setMostrarForm(true)} className="text-xs font-semibold text-navy-700 hover:underline">
              + Nova proposta
            </button>
          )}

          {podeCriar && mostrarForm && (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2 rounded-lg bg-navy-50/50 p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field">Título</label>
                <input
                  className="input-field"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Proposta para troca da bomba"
                  required
                />
              </div>
              {fornecedores.length > 0 ? (
                <div>
                  <label className="label-field">Empresa/fornecedor</label>
                  <select
                    className="input-field"
                    value={form.fornecedorId}
                    onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}
                  >
                    <option value="">Sem fornecedor cadastrado</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.razao_social}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div />
              )}
              <div>
                <label className="label-field">Valor (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Data da proposta (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataProposta}
                  onChange={(e) => setForm((f) => ({ ...f, dataProposta: e.target.value }))}
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
              <div className="sm:col-span-2">
                <label className="label-field">Observação (opcional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={form.comentario}
                  onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="btn-primary text-sm">
                  {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Registrar proposta"}
                </button>
                <button type="button" onClick={resetForm} className="text-xs font-semibold text-navy-500 hover:underline">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
