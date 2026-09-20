"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/adminFetch";

const PAPEL_LABELS = {
  condomino: "Condômino",
  porteiro: "Porteiro",
  conselheiro: "Conselheiro",
};

const emptyForm = { nome: "", email: "", password: "", papel: "condomino", unidade: "" };

export default function AcessosPage() {
  const { condominio } = useAuth();
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("membros")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setMembros(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await authedFetch("/api/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, condominioId: condominio.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar acesso.");
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(membro) {
    if (!confirm(`Remover o acesso de "${membro.nome}"? A conta de login dele será excluída.`)) return;
    setRemovingId(membro.id);
    try {
      const res = await authedFetch("/api/members/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominio.id,
          memberId: membro.id,
          userId: membro.user_id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao remover acesso.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Acessos</h1>
        <p className="mt-1 text-sm text-navy-500">
          Crie contas com acesso delimitado: condômino (só avisos, por enquanto), porteiro
          (ocorrências) ou conselheiro (propostas comerciais).
        </p>

        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field">Nome</label>
            <input
              className="input-field"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label-field">E-mail</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label-field">Senha inicial</label>
            <input
              type="password"
              className="input-field"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>
          <div>
            <label className="label-field">Papel</label>
            <select
              className="input-field"
              value={form.papel}
              onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value }))}
            >
              <option value="condomino">Condômino</option>
              <option value="porteiro">Porteiro</option>
              <option value="conselheiro">Conselheiro</option>
            </select>
          </div>
          {form.papel === "condomino" && (
            <div>
              <label className="label-field">Unidade</label>
              <input
                className="input-field"
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                placeholder="Ex: Apto 32"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Criando..." : "Criar acesso"}
            </button>
          </div>
        </form>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando acessos...</p>
      ) : membros.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum acesso delimitado criado ainda.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/50 text-left text-navy-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Unidade</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.id} className="border-b border-navy-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-navy-900">{m.nome}</td>
                  <td className="px-4 py-3 text-navy-600">{m.email}</td>
                  <td className="px-4 py-3 text-navy-600">{PAPEL_LABELS[m.papel]}</td>
                  <td className="px-4 py-3 text-navy-600">{m.unidade || "-"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemove(m)}
                      disabled={removingId === m.id}
                      className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                    >
                      {removingId === m.id ? "Removendo..." : "Remover acesso"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
