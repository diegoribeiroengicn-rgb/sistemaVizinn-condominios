"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import {
  CATEGORIAS_DESPESA_VIZINN,
  CATEGORIAS_RECEITA_VIZINN,
  STATUS_LANCAMENTO_LABELS,
  STATUS_LANCAMENTO_STYLES,
  formatarMoeda,
} from "@/lib/vizinnFinanceiro";
import { calcularStatusVencimento, VENCIMENTO_BADGE_STYLES } from "@/lib/financeiro";

const ABAS = [
  { id: "pagar", label: "Contas a pagar" },
  { id: "receber", label: "Contas a receber" },
];

const STATUS_FINAIS = ["pago", "cancelado"];

const emptyForm = {
  descricao: "",
  categoria: "",
  valor: "",
  dataVencimento: "",
  recorrente: false,
  observacoes: "",
};

export default function AdminFinanceiroContent() {
  const [aba, setAba] = useState("pagar");
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/lancamentos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar lançamentos.");
      setLancamentos(json.lancamentos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doAba = lancamentos.filter((l) => l.tipo === aba);
  const categorias = aba === "pagar" ? CATEGORIAS_DESPESA_VIZINN : CATEGORIAS_RECEITA_VIZINN;

  const totalPendente = doAba.filter((l) => l.status === "pendente").reduce((s, l) => s + Number(l.valor), 0);
  const totalPagoEsteMes = doAba
    .filter((l) => l.status === "pago" && (l.data_pagamento || "").slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s, l) => s + Number(l.valor), 0);

  async function handleCriar(e) {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) return;
    setSalvando(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: aba, ...form, valor: Number(form.valor) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar lançamento.");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function marcarStatus(lancamento, status) {
    try {
      const res = await authedFetch(`/api/admin/lancamentos/${lancamento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "pago" ? { data_pagamento: new Date().toISOString().slice(0, 10) } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function excluir(lancamento) {
    if (!confirm(`Excluir "${lancamento.descricao}"?`)) return;
    try {
      const res = await authedFetch(`/api/admin/lancamentos/${lancamento.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Financeiro do Vizinn</h1>
          <p className="mt-1 text-sm text-navy-500">
            Contas a pagar e a receber da própria operação (hospedagem, e-mail, WhatsApp, etc), separado
            do financeiro dos condomínios clientes.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-navy-600 hover:underline">
          ← Painel administrativo
        </Link>
      </div>

      <div className="flex gap-2 border-b border-navy-100">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
              aba === a.id ? "border-coral text-coral-700" : "border-transparent text-navy-500 hover:text-navy-800"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs text-navy-400">Pendente ({aba === "pagar" ? "a pagar" : "a receber"})</p>
          <p className="font-display text-2xl font-bold text-navy-900">{formatarMoeda(totalPendente)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-navy-400">{aba === "pagar" ? "Pago" : "Recebido"} este mês</p>
          <p className="font-display text-2xl font-bold text-navy-900">{formatarMoeda(totalPagoEsteMes)}</p>
        </div>
      </section>

      <div className="card">
        <h2 className="font-display text-base font-bold text-navy-900">
          Novo lançamento — {aba === "pagar" ? "conta a pagar" : "conta a receber"}
        </h2>
        <form onSubmit={handleCriar} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-field">Descrição</label>
            <input
              className="input-field"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder={aba === "pagar" ? "Ex: Supabase Pro — setembro" : "Ex: Assinatura extra — condomínio X"}
              required
            />
          </div>
          <div>
            <label className="label-field">Categoria</label>
            <select
              className="input-field"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
            >
              <option value="">Selecione</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label-field">Vencimento</label>
            <input
              type="date"
              className="input-field"
              value={form.dataVencimento}
              onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-navy-600">
              <input
                type="checkbox"
                checked={form.recorrente}
                onChange={(e) => setForm((f) => ({ ...f, recorrente: e.target.checked }))}
              />
              Recorrente (mensal)
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Observações</label>
            <input
              className="input-field"
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={salvando} className="btn-primary">
              {salvando ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </form>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando...</p>
      ) : doAba.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum lançamento ainda.</div>
      ) : (
        <div className="space-y-2">
          {doAba.map((l) => {
            const vencimento = calcularStatusVencimento(l.data_vencimento, l.status, STATUS_FINAIS);
            return (
              <div key={l.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-navy-900">{l.descricao}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_LANCAMENTO_STYLES[l.status]}`}>
                      {STATUS_LANCAMENTO_LABELS[l.status]}
                    </span>
                    {vencimento && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VENCIMENTO_BADGE_STYLES[vencimento.nivel]}`}>
                        {vencimento.emoji} {vencimento.label}
                      </span>
                    )}
                    {l.recorrente && (
                      <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-500">
                        Recorrente
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-navy-400">
                    {[l.categoria, l.data_vencimento ? `vence ${new Date(`${l.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-bold text-navy-900">{formatarMoeda(l.valor)}</span>
                  {l.status === "pendente" && (
                    <>
                      <button onClick={() => marcarStatus(l, "pago")} className="text-xs font-semibold text-emerald-700 hover:underline">
                        {aba === "pagar" ? "Marcar pago" : "Marcar recebido"}
                      </button>
                      <button onClick={() => marcarStatus(l, "cancelado")} className="text-xs font-semibold text-navy-400 hover:underline">
                        Cancelar
                      </button>
                    </>
                  )}
                  <button onClick={() => excluir(l)} className="text-xs font-semibold text-coral hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
