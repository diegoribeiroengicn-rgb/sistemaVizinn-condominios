"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { MODULO_LABELS, PAPEL_ALVO_LABELS } from "@/lib/chatbot";

const emptyForm = {
  titulo: "",
  modulo: "",
  papelAlvo: "",
  publico: false,
  respostaCurta: "",
  passoAPasso: "",
  palavrasChave: "",
};

export default function AdminChatbotContent() {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/base-conhecimento");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setItens(json.itens);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function editar(item) {
    setEditandoId(item.id);
    setForm({
      titulo: item.titulo,
      modulo: item.modulo || "",
      papelAlvo: item.papel_alvo || "",
      publico: item.publico,
      respostaCurta: item.resposta_curta,
      passoAPasso: item.passo_a_passo || "",
      palavrasChave: (item.palavras_chave || []).join(", "),
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(emptyForm);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.respostaCurta.trim()) return;
    setSalvando(true);
    setError("");
    try {
      const path = editandoId ? `/api/admin/base-conhecimento/${editandoId}` : "/api/admin/base-conhecimento";
      const res = await authedFetch(path, {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      cancelarEdicao();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(item) {
    await authedFetch(`/api/admin/base-conhecimento/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !item.ativo }),
    });
    await load();
  }

  async function excluir(item) {
    if (!confirm(`Excluir "${item.titulo}"?`)) return;
    await authedFetch(`/api/admin/base-conhecimento/${item.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Chatbot — Base de conhecimento</h1>
          <p className="mt-1 text-sm text-navy-500">
            FAQ + manual conversacional (Nível 1, sem IA). O que estiver aqui é o que o chatbot responde.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-navy-600 hover:underline">
          ← Painel administrativo
        </Link>
      </div>

      <div className="card">
        <h2 className="font-display text-base font-bold text-navy-900">
          {editandoId ? "Editando pergunta" : "Nova pergunta/resposta"}
        </h2>
        <form onSubmit={salvar} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-field">Título (ex: &quot;Cadastrar um visitante&quot;)</label>
            <input
              className="input-field"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label-field">Módulo (opcional)</label>
            <select
              className="input-field"
              value={form.modulo}
              onChange={(e) => setForm((f) => ({ ...f, modulo: e.target.value }))}
            >
              <option value="">Nenhum específico</option>
              {Object.entries(MODULO_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Só aparece pro papel (opcional)</label>
            <select
              className="input-field"
              value={form.papelAlvo}
              onChange={(e) => setForm((f) => ({ ...f, papelAlvo: e.target.value }))}
            >
              <option value="">Todos os papéis</option>
              {Object.entries(PAPEL_ALVO_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Resposta curta</label>
            <textarea
              className="input-field"
              rows={2}
              value={form.respostaCurta}
              onChange={(e) => setForm((f) => ({ ...f, respostaCurta: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Passo a passo detalhado (opcional)</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder={"1. ...\n2. ...\n3. ..."}
              value={form.passoAPasso}
              onChange={(e) => setForm((f) => ({ ...f, passoAPasso: e.target.value }))}
            />
            <p className="mt-1 text-xs text-navy-400">
              Se preenchido, o chatbot oferece &quot;quer que eu explique passo a passo?&quot; antes de mostrar.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Palavras-chave extras (separadas por vírgula)</label>
            <input
              className="input-field"
              placeholder="ex: visitante, convidado, liberar entrada"
              value={form.palavrasChave}
              onChange={(e) => setForm((f) => ({ ...f, palavrasChave: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-navy-600">
            <input
              type="checkbox"
              checked={form.publico}
              onChange={(e) => setForm((f) => ({ ...f, publico: e.target.checked }))}
            />
            Também aparece pra visitante (não logado) na página inicial
          </label>
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Adicionar"}
            </button>
            {editandoId && (
              <button type="button" onClick={cancelarEdicao} className="btn-secondary">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando...</p>
      ) : itens.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhuma pergunta cadastrada ainda.</div>
      ) : (
        <div className="space-y-2">
          {itens.map((item) => (
            <div key={item.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{item.titulo}</h3>
                  {!item.ativo && (
                    <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-400">Inativo</span>
                  )}
                  {item.publico && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">Público</span>
                  )}
                  {item.papel_alvo && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                      {PAPEL_ALVO_LABELS[item.papel_alvo] || item.papel_alvo}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-navy-400">{item.resposta_curta}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => editar(item)} className="text-xs font-semibold text-navy-500 hover:underline">
                  Editar
                </button>
                <button onClick={() => alternarAtivo(item)} className="text-xs font-semibold text-navy-500 hover:underline">
                  {item.ativo ? "Desativar" : "Reativar"}
                </button>
                <button onClick={() => excluir(item)} className="text-xs font-semibold text-coral hover:underline">
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
