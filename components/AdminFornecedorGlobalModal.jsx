"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { formatarCnpj } from "@/lib/validacaoDocumentos";

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
        categoria: json.global.categoria || "",
        status: json.global.status,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fornecedorId]);

  useEffect(() => {
    load();
  }, [load]);

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
          categoria: form.categoria.trim() || null,
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
              <div>
                <label className="label-field">Categoria</label>
                <input
                  className="input-field"
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
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
                        </p>
                        {a.observacao && <p className="mt-1 text-navy-600">{a.observacao}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
