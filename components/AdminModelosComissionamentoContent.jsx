"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";

const CAMPOS_NUMERICOS = [
  { key: "percentual_venda_propria", label: "Venda própria (%)" },
  { key: "percentual_indicacao", label: "Indicação — primeira venda (%)" },
  { key: "percentual_lideranca", label: "Liderança (%)" },
  { key: "meta_minima_lider", label: "Meta mínima do líder (vendas/mês)" },
  { key: "meta_minima_equipe", label: "Meta mínima da equipe (vendas/mês)" },
  { key: "limite_equipe_pequena", label: "Limite equipe pequena (até N diretos = 100%)" },
  { key: "percentual_equipe_grande", label: "% da equipe grande que precisa da meta" },
  { key: "meta_minima_secundaria", label: "Meta mínima dos demais (equipe grande)" },
];

const emptyForm = {
  nome: "",
  descricao: "",
  percentual_venda_propria: 80,
  percentual_indicacao: 5,
  percentual_lideranca: 3,
  meta_minima_lider: 3,
  meta_minima_equipe: 3,
  limite_equipe_pequena: 8,
  percentual_equipe_grande: 80,
  meta_minima_secundaria: 1,
  permite_indicacao: true,
  permite_lideranca: true,
  permite_emancipacao: true,
};

export default function AdminModelosComissionamentoContent() {
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null); // modelo sendo editado, ou "novo"
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/modelos-comissionamento");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar modelos.");
      setModelos(json.modelos);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function abrirEdicao(modelo) {
    setEditando(modelo.id);
    setForm({ ...emptyForm, ...modelo });
  }

  function abrirNovo() {
    setEditando("novo");
    setForm(emptyForm);
  }

  function abrirDuplicar(modelo) {
    setEditando("novo");
    setForm({ ...emptyForm, ...modelo, nome: `${modelo.nome} (cópia)`, duplicarDeId: modelo.id });
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setError("");
    try {
      const payload = { ...form };
      delete payload.id;
      delete payload.padrao;
      delete payload.versao;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.total_vendedores;

      const res =
        editando === "novo"
          ? await authedFetch("/api/admin/modelos-comissionamento", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await authedFetch(`/api/admin/modelos-comissionamento/${editando}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar modelo.");
      setEditando(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus(modelo) {
    try {
      const res = await authedFetch(`/api/admin/modelos-comissionamento/${modelo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: modelo.status === "ativo" ? "inativo" : "ativo" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao atualizar status.");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Configurações → Comissionamento</h1>
          <p className="mt-1 text-sm text-navy-500">
            Modelo padrão Vizinn + modelos personalizados por parceiro. Alterar as regras de um modelo cria uma
            nova versão — comissões já geradas nunca são recalculadas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={abrirNovo} className="btn-primary text-sm">+ Novo modelo</button>
          <Link href="/admin/pagamentos" className="text-sm font-semibold text-navy-600 hover:underline">
            ← Vendedores
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {modelos.map((m) => (
            <div key={m.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-navy-900">{m.nome}</h3>
                    {m.padrao && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">Padrão Vizinn</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"}`}>
                      {m.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                    <span className="text-xs text-navy-400">v{m.versao}</span>
                  </div>
                  {m.descricao && <p className="mt-1 text-sm text-navy-500">{m.descricao}</p>}
                  <p className="mt-2 text-xs text-navy-500">
                    Venda própria: <strong>{m.percentual_venda_propria}%</strong> · Indicação: <strong>{m.percentual_indicacao}%</strong> ·
                    {" "}Liderança: <strong>{m.percentual_lideranca}%</strong> · {m.total_vendedores} vendedor{m.total_vendedores === 1 ? "" : "es"} vinculado{m.total_vendedores === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => abrirEdicao(m)} className="text-xs font-semibold text-navy-600 hover:underline">Editar</button>
                  <button onClick={() => abrirDuplicar(m)} className="text-xs font-semibold text-navy-600 hover:underline">Duplicar</button>
                  {!m.padrao && (
                    <button onClick={() => alternarStatus(m)} className="text-xs font-semibold text-coral hover:underline">
                      {m.status === "ativo" ? "Desativar" : "Ativar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
            <h2 className="font-display text-lg font-bold text-navy-900">
              {editando === "novo" ? "Novo modelo de comissionamento" : "Editar modelo"}
            </h2>
            <form onSubmit={salvar} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field">Nome</label>
                <input className="input-field" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Descrição</label>
                <textarea className="input-field" rows={2} value={form.descricao || ""} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
              </div>
              {CAMPOS_NUMERICOS.map(({ key, label }) => (
                <div key={key}>
                  <label className="label-field">{label}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={form[key] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value === "" ? "" : Number(e.target.value) }))}
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input id="permite_indicacao" type="checkbox" checked={Boolean(form.permite_indicacao)} onChange={(e) => setForm((f) => ({ ...f, permite_indicacao: e.target.checked }))} />
                <label htmlFor="permite_indicacao" className="text-sm text-navy-700">Permite bonificação de indicação</label>
              </div>
              <div className="flex items-center gap-2">
                <input id="permite_lideranca" type="checkbox" checked={Boolean(form.permite_lideranca)} onChange={(e) => setForm((f) => ({ ...f, permite_lideranca: e.target.checked }))} />
                <label htmlFor="permite_lideranca" className="text-sm text-navy-700">Permite bonificação de liderança</label>
              </div>
              <div className="flex items-center gap-2">
                <input id="permite_emancipacao" type="checkbox" checked={Boolean(form.permite_emancipacao)} onChange={(e) => setForm((f) => ({ ...f, permite_emancipacao: e.target.checked }))} />
                <label htmlFor="permite_emancipacao" className="text-sm text-navy-700">Permite emancipação (carrossel)</label>
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={salvando} className="btn-primary text-sm">
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
                <button type="button" onClick={() => setEditando(null)} className="text-sm font-semibold text-navy-500 hover:underline">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
