"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { formatarCnpj } from "@/lib/validacaoDocumentos";
import CategoriasFornecedorInput from "@/components/CategoriasFornecedorInput";
import BolinhasDestaqueComercial from "@/components/BolinhasDestaqueComercial";
import {
  SITUACAO_PAGAMENTO_LABELS,
  SITUACAO_PAGAMENTO_STYLES,
  destaqueEstaVigente,
} from "@/lib/fornecedoresDestaque";

// Ficha completa de um fornecedor da base geral Vizinn, aberta a partir
// da lista em /admin/fornecedores — dados cadastrais editáveis, em
// quais condomínios ele é usado e as avaliações reais recebidas.
export default function AdminFornecedorGlobalModal({ fornecedorId, onClose, onChanged }) {
  const [detalhe, setDetalhe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const [destaque, setDestaque] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [formDestaque, setFormDestaque] = useState(null);
  const [salvandoDestaque, setSalvandoDestaque] = useState(false);
  const [erroDestaque, setErroDestaque] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/fornecedores-globais/${fornecedorId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar fornecedor.");
      setDetalhe(json);
      setForm({
        razaoSocial: json.global.razao_social,
        nomeFantasia: json.global.nome_fantasia || "",
        endereco: json.global.endereco || "",
        categorias: json.global.categorias?.length
          ? json.global.categorias
          : json.global.categoria
            ? [json.global.categoria]
            : [],
        status: json.global.status,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fornecedorId]);

  const loadDestaque = useCallback(async () => {
    setErroDestaque("");
    try {
      const res = await authedFetch(`/api/admin/fornecedores-globais/${fornecedorId}/destaque`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar destaque comercial.");
      setDestaque(json.destaque);
      setHistorico(json.historico);
      setFormDestaque({
        nivel: json.destaque?.nivel ?? 0,
        situacaoPagamento: json.destaque?.situacao_pagamento ?? "pendente",
        destaqueAtivo: json.destaque?.destaque_ativo ?? false,
        dataInicio: json.destaque?.data_inicio ?? "",
        dataFim: json.destaque?.data_fim ?? "",
        observacoes: json.destaque?.observacoes ?? "",
      });
    } catch (err) {
      setErroDestaque(err.message);
    }
  }, [fornecedorId]);

  useEffect(() => {
    load();
    loadDestaque();
  }, [load, loadDestaque]);

  async function handleSalvarDestaque(e) {
    e.preventDefault();
    setSalvandoDestaque(true);
    setErroDestaque("");
    try {
      const res = await authedFetch(`/api/admin/fornecedores-globais/${fornecedorId}/destaque`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nivel: formDestaque.nivel,
          situacaoPagamento: formDestaque.situacaoPagamento,
          destaqueAtivo: formDestaque.destaqueAtivo,
          dataInicio: formDestaque.dataInicio || null,
          dataFim: formDestaque.dataFim || null,
          observacoes: formDestaque.observacoes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar destaque comercial.");
      await loadDestaque();
      onChanged?.();
    } catch (err) {
      setErroDestaque(err.message);
    } finally {
      setSalvandoDestaque(false);
    }
  }

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/fornecedores-globais", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: fornecedorId,
          razao_social: form.razaoSocial.trim(),
          nome_fantasia: form.nomeFantasia.trim() || null,
          endereco: form.endereco.trim() || null,
          categorias: form.categorias,
          categoria: form.categorias[0] || null,
          status: form.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
      onChanged();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!confirm(`Excluir "${detalhe.global.razao_social}" da base geral? Os cadastros locais dos condomínios continuam existindo, só perdem o vínculo com a rede.`)) {
      return;
    }
    setExcluindo(true);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/fornecedores-globais?id=${fornecedorId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao excluir.");
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setExcluindo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-navy-900">Fornecedor da base Vizinn</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-navy-500">Carregando...</p>
        ) : !detalhe ? (
          <p className="mt-4 text-coral-700">{error || "Não encontrado."}</p>
        ) : (
          <div className="mt-4 space-y-6">
            {error && <p className="text-sm text-coral-700">{error}</p>}

            <form onSubmit={handleSalvar} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field">Razão social</label>
                <input
                  className="input-field"
                  value={form.razaoSocial}
                  onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label-field">Nome fantasia</label>
                <input
                  className="input-field"
                  value={form.nomeFantasia}
                  onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">CNPJ</label>
                <input className="input-field bg-navy-50" value={formatarCnpj(detalhe.global.cnpj || "")} disabled />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Categorias</label>
                <CategoriasFornecedorInput
                  value={form.categorias}
                  onChange={(categorias) => setForm((f) => ({ ...f, categorias }))}
                  inputId="categorias-fornecedor-admin"
                />
              </div>
              <div>
                <label className="label-field">Status</label>
                <select
                  className="input-field"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Endereço</label>
                <input
                  className="input-field"
                  value={form.endereco}
                  onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={salvando} className="btn-primary text-sm">
                  {salvando ? "Salvando..." : "Salvar alterações"}
                </button>
                <button
                  type="button"
                  onClick={handleExcluir}
                  disabled={excluindo}
                  className="text-sm font-semibold text-coral hover:underline disabled:opacity-50"
                >
                  {excluindo ? "Excluindo..." : "Excluir da base geral"}
                </button>
              </div>
            </form>

            <div>
              <h3 className="text-sm font-semibold text-navy-800">
                Condomínios que usam ({detalhe.relacionamentos.length})
              </h3>
              {detalhe.relacionamentos.length === 0 ? (
                <p className="mt-1 text-sm text-navy-400">Nenhum condomínio vinculado.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {detalhe.relacionamentos.map((r) => (
                    <li key={r.id} className="text-sm text-navy-600">
                      {r.condominios?.nome || "Condomínio"} — cadastrado como &ldquo;{r.razao_social}&rdquo; ({r.status})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-navy-800">
                Avaliações reais ({detalhe.avaliacoes.length})
              </h3>
              {detalhe.avaliacoes.length === 0 ? (
                <p className="mt-1 text-sm text-navy-400">Este fornecedor ainda não possui avaliações.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detalhe.avaliacoes.map((a) => {
                    const media = (a.nota_qualidade + a.nota_prazo + a.nota_custo + a.nota_atendimento) / 4;
                    return (
                      <li key={a.id} className="rounded-lg border border-navy-100 p-2 text-sm">
                        <p className="font-medium text-navy-800">
                          ⭐ {media.toFixed(1)} — {a.condominios?.nome || "Condomínio"} ·{" "}
                          {new Date(a.created_at).toLocaleDateString("pt-BR")}
                          {a.condominio_publico && (
                            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                              🌐 Visível na Rede Vizinn
                            </span>
                          )}
                        </p>
                        {a.observacao && <p className="mt-1 text-navy-600">{a.observacao}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-navy-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-navy-800">Destaque Comercial</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    destaqueEstaVigente(destaque) ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
                  }`}
                >
                  {destaqueEstaVigente(destaque) ? "Vigente" : "Não vigente"}
                </span>
              </div>
              <p className="mt-1 text-xs text-navy-400">
                Informação só do painel admin — nunca aparece pro fornecedor, condomínio ou morador. Só
                influencia a ordem de exibição na Rede de Fornecedores Vizinn (nunca a nota, que continua
                vindo só das avaliações reais).
              </p>

              {erroDestaque && <p className="mt-2 text-sm text-coral-700">{erroDestaque}</p>}

              {!formDestaque ? (
                <p className="mt-2 text-sm text-navy-400">Carregando...</p>
              ) : (
                <form onSubmit={handleSalvarDestaque} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-field">Nível</label>
                    <BolinhasDestaqueComercial
                      nivel={formDestaque.nivel}
                      onChange={(nivel) => setFormDestaque((f) => ({ ...f, nivel }))}
                    />
                  </div>
                  <div>
                    <label className="label-field">
                      Situação do pagamento{" "}
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          SITUACAO_PAGAMENTO_STYLES[formDestaque.situacaoPagamento] || "bg-navy-100 text-navy-500"
                        }`}
                      >
                        {SITUACAO_PAGAMENTO_LABELS[formDestaque.situacaoPagamento]}
                      </span>
                    </label>
                    <select
                      className="input-field"
                      value={formDestaque.situacaoPagamento}
                      onChange={(e) => setFormDestaque((f) => ({ ...f, situacaoPagamento: e.target.value }))}
                    >
                      {Object.entries(SITUACAO_PAGAMENTO_LABELS).map(([valor, label]) => (
                        <option key={valor} value={valor}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="destaque-ativo"
                      type="checkbox"
                      checked={formDestaque.destaqueAtivo}
                      onChange={(e) => setFormDestaque((f) => ({ ...f, destaqueAtivo: e.target.checked }))}
                    />
                    <label htmlFor="destaque-ativo" className="text-sm text-navy-700">
                      Destaque ativo
                    </label>
                  </div>
                  <div />
                  <div>
                    <label className="label-field">Vigência — início</label>
                    <input
                      type="date"
                      className="input-field"
                      value={formDestaque.dataInicio}
                      onChange={(e) => setFormDestaque((f) => ({ ...f, dataInicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label-field">Vigência — término</label>
                    <input
                      type="date"
                      className="input-field"
                      value={formDestaque.dataFim}
                      onChange={(e) => setFormDestaque((f) => ({ ...f, dataFim: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label-field">Observações administrativas</label>
                    <textarea
                      className="input-field"
                      rows={2}
                      value={formDestaque.observacoes}
                      onChange={(e) => setFormDestaque((f) => ({ ...f, observacoes: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button type="submit" disabled={salvandoDestaque} className="btn-primary text-sm">
                      {salvandoDestaque ? "Salvando..." : "Salvar destaque comercial"}
                    </button>
                  </div>
                </form>
              )}

              {historico.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-navy-400">Histórico</h4>
                  <ul className="mt-2 space-y-1">
                    {historico.map((h) => (
                      <li key={h.id} className="text-xs text-navy-500">
                        {new Date(h.created_at).toLocaleString("pt-BR")} — {h.alterado_por_email || "admin"}:
                        nível {h.nivel_anterior ?? "-"} → {h.nivel_novo}, pagamento{" "}
                        {SITUACAO_PAGAMENTO_LABELS[h.situacao_pagamento_anterior] || h.situacao_pagamento_anterior || "-"}{" "}
                        → {SITUACAO_PAGAMENTO_LABELS[h.situacao_pagamento_novo] || h.situacao_pagamento_novo}, ativo{" "}
                        {h.destaque_ativo_anterior === null ? "-" : h.destaque_ativo_anterior ? "sim" : "não"} →{" "}
                        {h.destaque_ativo_novo ? "sim" : "não"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
