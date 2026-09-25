"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { PLANS } from "@/lib/plans";
import { TIPO_CUPOM_LABELS } from "@/lib/cupons";
import ValorPrivado, { BotaoAlternarValores } from "@/components/ValorPrivado";
import AdminVendedorDetalheModal from "@/components/AdminVendedorDetalheModal";

const ABAS = [
  { id: "taxas", label: "Taxas de adesão" },
  { id: "vendedores", label: "Vendedores" },
  { id: "cupons", label: "Cupons" },
];

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function PainelTaxas() {
  const [taxas, setTaxas] = useState({});
  const [valores, setValores] = useState({});
  const [salvandoPlano, setSalvandoPlano] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await authedFetch("/api/admin/taxas-adesao");
    const json = await res.json();
    if (!res.ok) return setError(json.error);
    const mapa = {};
    for (const t of json.taxas) mapa[t.plano_id] = Number(t.valor);
    setTaxas(mapa);
    setValores(mapa);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function salvar(planoId) {
    setSalvandoPlano(planoId);
    setError("");
    try {
      const res = await authedFetch("/api/admin/taxas-adesao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planoId, valor: Number(valores[planoId]) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvandoPlano(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy-500">
        Cobrada uma única vez, na hora que alguém assina direto pelo site. Some com o cupom aplicado
        (se houver) pra formar o valor final cobrado no cadastro.
      </p>
      {error && <p className="text-sm text-coral-700">{error}</p>}
      {PLANS.map((plan) => (
        <div key={plan.id} className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-navy-900">{plan.name}</p>
            <p className="text-xs text-navy-400">Mensalidade: {formatBRL(plan.price)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-navy-500">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field w-28"
              value={valores[plan.id] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [plan.id]: e.target.value }))}
            />
            <button
              onClick={() => salvar(plan.id)}
              disabled={salvandoPlano !== null || Number(valores[plan.id]) === taxas[plan.id]}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {salvandoPlano === plan.id ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const emptyVendedor = { nome: "", email: "", telefone: "", indicadorOriginalId: "", modeloComissionamentoId: "" };

function PainelVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [form, setForm] = useState(emptyVendedor);
  const [criando, setCriando] = useState(false);
  const [error, setError] = useState("");
  const [selecionadoId, setSelecionadoId] = useState(null);

  const load = useCallback(async () => {
    const [resVend, resModelos] = await Promise.all([
      authedFetch("/api/admin/vendedores"),
      authedFetch("/api/admin/modelos-comissionamento"),
    ]);
    const json = await resVend.json();
    const jsonModelos = await resModelos.json();
    if (!resVend.ok) return setError(json.error);
    setVendedores(json.vendedores);
    if (resModelos.ok) setModelos(jsonModelos.modelos.filter((m) => m.status === "ativo"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function criar(e) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setCriando(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/vendedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          indicadorOriginalId: form.indicadorOriginalId || null,
          modeloComissionamentoId: form.modeloComissionamentoId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setForm(emptyVendedor);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCriando(false);
    }
  }

  async function mudarModelo(vendedor, modeloComissionamentoId) {
    await authedFetch(`/api/admin/vendedores/${vendedor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modeloComissionamentoId: modeloComissionamentoId || null }),
    });
    await load();
  }

  async function alternarAtivo(vendedor) {
    await authedFetch(`/api/admin/vendedores/${vendedor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !vendedor.ativo }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BotaoAlternarValores />
      </div>

      <div className="card">
        <h2 className="font-display text-base font-bold text-navy-900">Novo vendedor</h2>
        <form onSubmit={criar} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            className="input-field sm:col-span-2"
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
          />
          <input
            className="input-field"
            placeholder="E-mail (opcional)"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Telefone (opcional)"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
          />
          <select
            className="input-field sm:col-span-2"
            value={form.indicadorOriginalId}
            onChange={(e) => setForm((f) => ({ ...f, indicadorOriginalId: e.target.value }))}
          >
            <option value="">Sem indicador (vendedor raiz / líder independente)</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>Indicado por: {v.nome}</option>
            ))}
          </select>
          <select
            className="input-field sm:col-span-2"
            value={form.modeloComissionamentoId}
            onChange={(e) => setForm((f) => ({ ...f, modeloComissionamentoId: e.target.value }))}
          >
            <option value="">Modelo padrão Vizinn</option>
            {modelos.filter((m) => !m.padrao).map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
          <button type="submit" disabled={criando} className="btn-primary sm:col-span-2">
            {criando ? "Criando..." : "Adicionar vendedor"}
          </button>
        </form>
        <p className="mt-2 text-xs text-navy-400">
          Vendedores autônomos com acordo diferente do padrão (80/5/3%) — crie o modelo dele em{" "}
          <Link href="/admin/configuracoes/comissionamento" className="font-semibold text-navy-600 hover:underline">
            Configurações → Comissionamento
          </Link>{" "}
          e selecione aqui.
        </p>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      <div className="space-y-2">
        {vendedores.map((v) => (
          <div key={v.id} className="card flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setSelecionadoId(v.id)} className="text-left">
              <p className="font-semibold text-navy-900 hover:underline">
                {v.nome}
                {!v.ativo && (
                  <span className="ml-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-400">Inativo</span>
                )}
                {v.status_cadastro === "pendente" && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pendente</span>
                )}
                {v.emancipado && (
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Líder independente</span>
                )}
              </p>
              <p className="text-xs text-navy-400">
                {[v.email, v.telefone, v.codigo_indicacao ? `código: ${v.codigo_indicacao}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </button>
            <div className="flex items-center gap-4 text-right">
              <select
                className="input-field w-auto text-xs"
                value={v.modelo_comissionamento_id || ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => mudarModelo(v, e.target.value)}
                title="Modelo de comissionamento"
              >
                <option value="">Padrão Vizinn</option>
                {modelos.filter((m) => !m.padrao).map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
              <div>
                <p className="text-xs text-navy-400">{v.vendas} venda(s)</p>
                <p className="text-sm font-semibold text-navy-900"><ValorPrivado valor={formatBRL(v.comissao_total)} /></p>
                <p className="text-xs font-semibold text-amber-700"><ValorPrivado valor={formatBRL(v.comissao_pendente)} /> pendente</p>
              </div>
              <button onClick={() => alternarAtivo(v)} className="text-xs font-semibold text-navy-500 hover:underline">
                {v.ativo ? "Desativar" : "Reativar"}
              </button>
            </div>
          </div>
        ))}
        {vendedores.length === 0 && <div className="card text-center text-navy-400">Nenhum vendedor cadastrado ainda.</div>}
      </div>

      {selecionadoId && (
        <AdminVendedorDetalheModal
          vendedorId={selecionadoId}
          onClose={() => setSelecionadoId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

const emptyCupom = { codigo: "", vendedorId: "", tipo: "percentual", valor: "", usosMaximo: "" };

function PainelCupons() {
  const [cupons, setCupons] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [form, setForm] = useState(emptyCupom);
  const [criando, setCriando] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [cRes, vRes] = await Promise.all([authedFetch("/api/admin/cupons"), authedFetch("/api/admin/vendedores")]);
    const cJson = await cRes.json();
    const vJson = await vRes.json();
    if (!cRes.ok) return setError(cJson.error);
    setCupons(cJson.cupons);
    setVendedores(vJson.vendedores || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function criar(e) {
    e.preventDefault();
    if (!form.codigo.trim()) return;
    setCriando(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/cupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setForm(emptyCupom);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCriando(false);
    }
  }

  async function alternarAtivo(cupom) {
    await authedFetch(`/api/admin/cupons/${cupom.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !cupom.ativo }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-display text-base font-bold text-navy-900">Novo cupom</h2>
        <form onSubmit={criar} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input
            className="input-field sm:col-span-2"
            placeholder="Código (ex: JOAO10)"
            value={form.codigo}
            onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
            required
          />
          <select
            className="input-field"
            value={form.vendedorId}
            onChange={(e) => setForm((f) => ({ ...f, vendedorId: e.target.value }))}
          >
            <option value="">Sem vendedor</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          >
            {Object.entries(TIPO_CUPOM_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
          {form.tipo !== "isencao" && (
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field"
              placeholder={form.tipo === "percentual" ? "% de desconto" : "R$ de desconto"}
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              required
            />
          )}
          <input
            type="number"
            min="1"
            className="input-field"
            placeholder="Limite de usos (opcional)"
            value={form.usosMaximo}
            onChange={(e) => setForm((f) => ({ ...f, usosMaximo: e.target.value }))}
          />
          <button type="submit" disabled={criando} className="btn-primary sm:col-span-5">
            {criando ? "Criando..." : "Criar cupom"}
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      <div className="space-y-2">
        {cupons.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-navy-900">
                {c.codigo}
                {!c.ativo && (
                  <span className="ml-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-400">Inativo</span>
                )}
              </p>
              <p className="text-xs text-navy-400">
                {[
                  TIPO_CUPOM_LABELS[c.tipo],
                  c.tipo !== "isencao" ? (c.tipo === "percentual" ? `${c.valor}%` : formatBRL(c.valor)) : null,
                  c.vendedores?.nome ? `vendedor: ${c.vendedores.nome}` : "sem vendedor",
                  `${c.usos_atual} uso(s)${c.usos_maximo ? ` de ${c.usos_maximo}` : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button onClick={() => alternarAtivo(c)} className="text-xs font-semibold text-navy-500 hover:underline">
              {c.ativo ? "Desativar" : "Reativar"}
            </button>
          </div>
        ))}
        {cupons.length === 0 && <div className="card text-center text-navy-400">Nenhum cupom criado ainda.</div>}
      </div>
    </div>
  );
}

export default function AdminPagamentosContent() {
  const [aba, setAba] = useState("taxas");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Pagamentos</h1>
          <p className="mt-1 text-sm text-navy-500">
            Taxa de adesão por plano, vendedores e cupons de desconto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
          <Link href="/admin/comissoes" className="text-navy-600 hover:underline">Comissões →</Link>
          <Link href="/admin/configuracoes/comissionamento" className="text-navy-600 hover:underline">Comissionamento →</Link>
          <Link href="/admin" className="text-navy-600 hover:underline">← Painel administrativo</Link>
        </div>
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

      {aba === "taxas" && <PainelTaxas />}
      {aba === "vendedores" && <PainelVendedores />}
      {aba === "cupons" && <PainelCupons />}
    </div>
  );
}
