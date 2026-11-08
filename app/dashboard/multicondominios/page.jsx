"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  STATUS_PAGAR_FINAIS,
  STATUS_RECEBER_FINAIS,
  calcularStatusVencimento,
  formatarMoeda,
} from "@/lib/financeiro";
import { PERIODO_OPTIONS, calcularIntervaloPeriodo, dentroDoIntervalo, formatarIntervalo } from "@/lib/periodo";
import { calcularEquivalenciaTotal, calcularMensalidade, diasRestantesTrial } from "@/lib/multicondominios";
import { PLANS } from "@/lib/plans";

const NOVO_CONDOMINIO_VAZIO = { nome: "", cnpj: "", endereco: "", responsavelNome: "", responsavelTelefone: "", planoId: "growth" };

function ExtratoSaldoAsaas() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch("/api/multicondominios/extrato", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar o extrato.");
      setDados(json);
    } catch (err) {
      setErro(err.message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (erro) return <div className="card"><p className="text-sm text-coral-700">{erro}</p></div>;
  if (!dados) return <div className="card"><p className="text-sm text-navy-400">Carregando extrato de saldo...</p></div>;

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">Saldo disponível (Asaas)</h2>
        {dados.totalSaldo != null && (
          <p className="font-display text-lg font-bold text-navy-900">{formatarMoeda(dados.totalSaldo)}</p>
        )}
      </div>
      <div className="space-y-2">
        {dados.condominios.map((c) => (
          <div key={c.condominioId} className="flex items-center justify-between border-b border-navy-50 py-1.5 text-sm last:border-0">
            <span className="text-navy-700">{c.nome}</span>
            {!c.ativo ? (
              <span className="text-xs text-navy-400">cobrança via boleto não ativada</span>
            ) : c.saldo == null ? (
              <span className="text-xs text-navy-400">indisponível agora</span>
            ) : (
              <span className="font-semibold text-navy-900">{formatarMoeda(c.saldo)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NovoCondominioForm({ onCriado }) {
  const [form, setForm] = useState(NOVO_CONDOMINIO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    if (!form.nome.trim()) {
      setErro("Informe o nome do condomínio.");
      return;
    }
    setSalvando(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch("/api/condominios/cadastrar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não foi possível cadastrar o condomínio.");
      setForm(NOVO_CONDOMINIO_VAZIO);
      setAberto(false);
      await onCriado(json.condominio);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn-secondary">
        + Cadastrar novo condomínio
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-display text-base font-bold text-navy-900">Cadastrar novo condomínio</h2>
      {erro && <p className="text-sm text-coral-700">{erro}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          className="input-field"
          placeholder="Nome do condomínio *"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
        />
        <input
          className="input-field"
          placeholder="CNPJ"
          value={form.cnpj}
          onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
        />
        <input
          className="input-field sm:col-span-2"
          placeholder="Endereço"
          value={form.endereco}
          onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
        />
        <input
          className="input-field"
          placeholder="Responsável"
          value={form.responsavelNome}
          onChange={(e) => setForm((f) => ({ ...f, responsavelNome: e.target.value }))}
        />
        <input
          className="input-field"
          placeholder="Telefone do responsável"
          value={form.responsavelTelefone}
          onChange={(e) => setForm((f) => ({ ...f, responsavelTelefone: e.target.value }))}
        />
        <select
          className="input-field sm:col-span-2"
          value={form.planoId}
          onChange={(e) => setForm((f) => ({ ...f, planoId: e.target.value }))}
        >
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — até {p.unitLimit} unidades
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? "Cadastrando..." : "Cadastrar"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setAberto(false)} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// Visão consolidada — Etapa 3 do upgrade Pro+ Multicondomínios. Só
// agrega dados que o próprio RLS já deixa o dono ver (um `select ...
// where condominio_id = any(...)` simplesmente retorna, linha a linha,
// só os condomínios que `is_condominio_owner()` aprova pra esse
// usuário — não precisou de nenhuma policy nova pra isso).
export default function MulticondominiosPage() {
  const { role, condominio, condominiosDoDono, temProPlusMulticondominios, proPlusTrialFim, trocarCondominio, refreshCondominio } =
    useAuth();
  const router = useRouter();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes_atual");
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState({ inicio: "", fim: "" });
  const [filtroCondominioId, setFiltroCondominioId] = useState("todos");
  const [faixasPreco, setFaixasPreco] = useState([]);

  const condominioIds = useMemo(() => condominiosDoDono.map((c) => c.id), [condominiosDoDono]);
  const podeAdicionar = role === "sindico" && temProPlusMulticondominios;
  const habilitado = podeAdicionar && condominioIds.length > 1;

  const handleCondominioCriado = useCallback(
    async (novoCondominio) => {
      await refreshCondominio();
      if (novoCondominio?.id) trocarCondominio(novoCondominio.id);
    },
    [refreshCondominio, trocarCondominio]
  );
  const diasTrial = diasRestantesTrial(proPlusTrialFim);
  const equivalenciaTotal = useMemo(() => calcularEquivalenciaTotal(condominiosDoDono), [condominiosDoDono]);
  const mensalidadeEstimada = useMemo(() => calcularMensalidade(equivalenciaTotal, faixasPreco), [equivalenciaTotal, faixasPreco]);

  useEffect(() => {
    if (!habilitado) return;
    fetch("/api/public/multicondominios-faixas")
      .then((res) => res.json())
      .then((json) => setFaixasPreco(json.faixas || []))
      .catch(() => {});
  }, [habilitado]);

  const load = useCallback(async () => {
    if (!habilitado) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [membros, contasReceber, contasPagar] = await Promise.all([
      supabase.from("membros").select("condominio_id").in("condominio_id", condominioIds).eq("papel", "condomino"),
      supabase
        .from("contas_receber")
        .select("condominio_id, status, valor, valor_recebido, data_vencimento, data_recebimento")
        .in("condominio_id", condominioIds),
      supabase
        .from("contas_pagar")
        .select("condominio_id, status, valor, data_vencimento, data_pagamento")
        .in("condominio_id", condominioIds),
    ]);

    setDados({
      membros: membros.data || [],
      contasReceber: contasReceber.data || [],
      contasPagar: contasPagar.data || [],
    });
    setLoading(false);
  }, [habilitado, condominioIds]);

  useEffect(() => {
    load();
  }, [load]);

  const intervalo = calcularIntervaloPeriodo(periodo, periodoPersonalizado);

  const porCondominio = useMemo(() => {
    if (!dados) return [];
    return condominiosDoDono
      .filter((c) => filtroCondominioId === "todos" || c.id === filtroCondominioId)
      .map((c) => {
        const unidades = dados.membros.filter((m) => m.condominio_id === c.id).length;
        const receberDoCondo = dados.contasReceber.filter((cr) => cr.condominio_id === c.id);
        const pagarDoCondo = dados.contasPagar.filter((cp) => cp.condominio_id === c.id);
        const receberAbertas = receberDoCondo.filter((cr) => !STATUS_RECEBER_FINAIS.includes(cr.status));
        const receberVencidas = receberDoCondo.filter(
          (cr) => calcularStatusVencimento(cr.data_vencimento, cr.status, STATUS_RECEBER_FINAIS)?.nivel === "vermelho"
        );
        const recebidoNoPeriodo = receberDoCondo
          .filter((cr) => cr.status === "recebida" && dentroDoIntervalo(cr.data_recebimento, intervalo))
          .reduce((s, cr) => s + Number(cr.valor_recebido ?? cr.valor ?? 0), 0);
        const pagoNoPeriodo = pagarDoCondo
          .filter((cp) => cp.status === "pago" && dentroDoIntervalo(cp.data_pagamento, intervalo))
          .reduce((s, cp) => s + Number(cp.valor || 0), 0);
        return {
          id: c.id,
          nome: c.nome,
          unidades,
          cobrancasAbertas: receberAbertas.length,
          cobrancasVencidas: receberVencidas.length,
          recebidoNoPeriodo,
          pagoNoPeriodo,
          saldoNoPeriodo: recebidoNoPeriodo - pagoNoPeriodo,
        };
      });
  }, [dados, condominiosDoDono, filtroCondominioId, intervalo]);

  const totais = useMemo(
    () =>
      porCondominio.reduce(
        (acc, c) => ({
          unidades: acc.unidades + c.unidades,
          cobrancasAbertas: acc.cobrancasAbertas + c.cobrancasAbertas,
          cobrancasVencidas: acc.cobrancasVencidas + c.cobrancasVencidas,
          recebidoNoPeriodo: acc.recebidoNoPeriodo + c.recebidoNoPeriodo,
          pagoNoPeriodo: acc.pagoNoPeriodo + c.pagoNoPeriodo,
          saldoNoPeriodo: acc.saldoNoPeriodo + c.saldoNoPeriodo,
        }),
        { unidades: 0, cobrancasAbertas: 0, cobrancasVencidas: 0, recebidoNoPeriodo: 0, pagoNoPeriodo: 0, saldoNoPeriodo: 0 }
      ),
    [porCondominio]
  );

  function abrirCondominio(id) {
    trocarCondominio(id);
    router.push("/dashboard");
  }

  if (!habilitado) {
    return (
      <div className="space-y-6">
        <div className="card text-center text-navy-500">
          {podeAdicionar
            ? "Cadastre mais um condomínio na sua conta pra habilitar a visão consolidada do Pro+ Multicondomínios."
            : "A Plataforma Multicondomínios é um recurso Pro+, pra quem administra mais de um condomínio com a mesma conta. Fale com o suporte da AquiHabitto se você administra vários condomínios e quer habilitar."}
        </div>
        {podeAdicionar && (
          <div className="flex justify-center">
            <NovoCondominioForm onCriado={handleCondominioCriado} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Plataforma Multicondomínios</h1>
        <p className="mt-1 text-sm text-navy-500">Visão consolidada de todos os condomínios vinculados à sua conta.</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-navy-600">
          <span>
            Porte somado: <strong className="text-navy-900">{equivalenciaTotal} equivalente{equivalenciaTotal === 1 ? "" : "s"}</strong>
          </span>
          {mensalidadeEstimada != null && (
            <span>
              Mensalidade Pro+: <strong className="text-navy-900">{formatarMoeda(mensalidadeEstimada)}/mês</strong>
            </span>
          )}
        </div>
        {diasTrial != null && (
          <p className={`mt-2 text-xs font-medium ${diasTrial === 0 ? "text-coral-700" : "text-emerald-700"}`}>
            {diasTrial > 0
              ? `Teste grátis Pro+ Multicondomínios — ${diasTrial} dia${diasTrial === 1 ? "" : "s"} restante${diasTrial === 1 ? "" : "s"}.`
              : "Seu teste grátis do Pro+ Multicondomínios terminou — fale com o suporte pra continuar."}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <NovoCondominioForm onCriado={handleCondominioCriado} />
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-navy-600">Condomínio:</p>
        <select className="input-field w-auto" value={filtroCondominioId} onChange={(e) => setFiltroCondominioId(e.target.value)}>
          <option value="todos">Todos</option>
          {condominiosDoDono.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <p className="text-sm font-medium text-navy-600">Período:</p>
        <select className="input-field w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODO_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {periodo === "personalizado" && (
          <>
            <input
              type="date"
              className="input-field w-auto"
              value={periodoPersonalizado.inicio}
              onChange={(e) => setPeriodoPersonalizado((p) => ({ ...p, inicio: e.target.value }))}
            />
            <span className="text-navy-400">até</span>
            <input
              type="date"
              className="input-field w-auto"
              value={periodoPersonalizado.fim}
              onChange={(e) => setPeriodoPersonalizado((p) => ({ ...p, fim: e.target.value }))}
            />
          </>
        )}
        {intervalo && <p className="text-xs text-navy-400">{formatarIntervalo(intervalo)}</p>}
      </div>

      {loading ? (
        <p className="text-navy-500">Carregando indicadores consolidados...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="card">
              <p className="text-xs text-navy-400">Condomínios</p>
              <p className="mt-1 font-display text-xl font-bold text-navy-900">{condominiosDoDono.length}</p>
            </div>
            <div className="card">
              <p className="text-xs text-navy-400">Unidades (total)</p>
              <p className="mt-1 font-display text-xl font-bold text-navy-900">{totais.unidades}</p>
            </div>
            <div className="card">
              <p className="text-xs text-navy-400">Cobranças em aberto</p>
              <p className="mt-1 font-display text-xl font-bold text-navy-900">{totais.cobrancasAbertas}</p>
            </div>
            <div className="card">
              <p className="text-xs text-navy-400">Cobranças vencidas</p>
              <p className="mt-1 font-display text-xl font-bold text-coral-700">{totais.cobrancasVencidas}</p>
            </div>
            <div className="card">
              <p className="text-xs text-navy-400">Recebido no período</p>
              <p className="mt-1 font-display text-xl font-bold text-emerald-700">{formatarMoeda(totais.recebidoNoPeriodo)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-navy-400">Saldo no período</p>
              <p className="mt-1 font-display text-xl font-bold text-navy-900">{formatarMoeda(totais.saldoNoPeriodo)}</p>
            </div>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-navy-50/50 text-left text-navy-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Condomínio</th>
                  <th className="px-4 py-3 font-medium">Unidades</th>
                  <th className="px-4 py-3 font-medium">Em aberto</th>
                  <th className="px-4 py-3 font-medium">Vencidas</th>
                  <th className="px-4 py-3 font-medium">Recebido no período</th>
                  <th className="px-4 py-3 font-medium">Saldo no período</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {porCondominio.map((c) => (
                  <tr key={c.id} className="border-t border-navy-50">
                    <td className="px-4 py-3 font-medium text-navy-800">{c.nome}</td>
                    <td className="px-4 py-3">{c.unidades}</td>
                    <td className="px-4 py-3">{c.cobrancasAbertas}</td>
                    <td className="px-4 py-3 text-coral-700">{c.cobrancasVencidas}</td>
                    <td className="px-4 py-3 text-emerald-700">{formatarMoeda(c.recebidoNoPeriodo)}</td>
                    <td className="px-4 py-3">{formatarMoeda(c.saldoNoPeriodo)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => abrirCondominio(c.id)} className="text-xs font-semibold text-coral hover:underline">
                        {c.id === condominio?.id ? "Ativo" : "Abrir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ExtratoSaldoAsaas />
        </>
      )}
    </div>
  );
}
