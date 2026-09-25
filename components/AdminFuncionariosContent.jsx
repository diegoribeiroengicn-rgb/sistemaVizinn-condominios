"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { ADMIN_MODULOS } from "@/lib/adminModulos";

const emptyForm = { nome: "", email: "", modulosPermitidos: [] };

export default function AdminFuncionariosContent() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [criando, setCriando] = useState(false);
  const [acaoId, setAcaoId] = useState(null);
  const [mensagens, setMensagens] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/funcionarios");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar funcionários.");
      setFuncionarios(json.funcionarios);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function alternarModuloForm(modulo) {
    setForm((f) => ({
      ...f,
      modulosPermitidos: f.modulosPermitidos.includes(modulo)
        ? f.modulosPermitidos.filter((m) => m !== modulo)
        : [...f.modulosPermitidos, modulo],
    }));
  }

  async function criar(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) return;
    setCriando(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/funcionarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar funcionário.");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCriando(false);
    }
  }

  async function alternarModulo(funcionario, modulo) {
    const novosModulos = funcionario.modulos_permitidos.includes(modulo)
      ? funcionario.modulos_permitidos.filter((m) => m !== modulo)
      : [...funcionario.modulos_permitidos, modulo];
    await authedFetch(`/api/admin/funcionarios/${funcionario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulosPermitidos: novosModulos }),
    });
    await load();
  }

  async function alternarAtivo(funcionario) {
    await authedFetch(`/api/admin/funcionarios/${funcionario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !funcionario.ativo }),
    });
    await load();
  }

  async function criarAcesso(funcionario) {
    setAcaoId(funcionario.id);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/funcionarios/${funcionario.id}/criar-acesso`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar acesso.");
      setMensagens((m) => ({ ...m, [funcionario.id]: "Acesso criado! Mandamos um e-mail pra definir a senha." }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAcaoId(null);
    }
  }

  async function excluir(funcionario) {
    if (!confirm(`Excluir "${funcionario.nome}"? Remove o acesso ao painel também.`)) return;
    setAcaoId(funcionario.id);
    setError("");
    try {
      const res = await authedFetch(`/api/admin/funcionarios/${funcionario.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao excluir.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAcaoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Funcionários</h1>
          <p className="mt-1 text-sm text-navy-500">
            Equipe do Vizinn com acesso ao painel admin — cada um só vê os módulos marcados abaixo.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-navy-600 hover:underline">
          ← Painel administrativo
        </Link>
      </div>

      <div className="card">
        <h2 className="font-display text-base font-bold text-navy-900">Novo funcionário</h2>
        <form onSubmit={criar} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className="input-field"
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
          />
          <input
            type="email"
            className="input-field"
            placeholder="E-mail"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <div className="sm:col-span-2">
            <label className="label-field">O que esse funcionário pode ver</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {ADMIN_MODULOS.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5 rounded-full border border-navy-200 px-3 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={form.modulosPermitidos.includes(m.id)}
                    onChange={() => alternarModuloForm(m.id)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={criando} className="btn-primary sm:col-span-2">
            {criando ? "Criando..." : "Adicionar funcionário"}
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {funcionarios.map((f) => (
            <div key={f.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy-900">
                    {f.nome}
                    {!f.ativo && <span className="ml-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-400">Inativo</span>}
                    {f.user_id && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Acesso liberado</span>}
                  </p>
                  <p className="text-xs text-navy-400">{f.email}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => criarAcesso(f)}
                    disabled={acaoId === f.id}
                    className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                  >
                    {acaoId === f.id ? "..." : f.user_id ? "Reenviar e-mail de senha" : "Criar acesso"}
                  </button>
                  <button onClick={() => alternarAtivo(f)} className="text-xs font-semibold text-navy-500 hover:underline">
                    {f.ativo ? "Desativar" : "Reativar"}
                  </button>
                  <button onClick={() => excluir(f)} disabled={acaoId === f.id} className="text-xs font-semibold text-coral hover:underline disabled:opacity-50">
                    Excluir
                  </button>
                </div>
              </div>
              {mensagens[f.id] && <p className="mt-2 text-xs font-medium text-emerald-700">{mensagens[f.id]}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {ADMIN_MODULOS.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 rounded-full border border-navy-200 px-3 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={f.modulos_permitidos.includes(m.id)}
                      onChange={() => alternarModulo(f, m.id)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {funcionarios.length === 0 && <div className="card text-center text-navy-400">Nenhum funcionário cadastrado ainda.</div>}
        </div>
      )}
    </div>
  );
}
