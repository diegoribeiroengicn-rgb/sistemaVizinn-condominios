"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import BotaoExcluirComAuditoria from "@/components/BotaoExcluirComAuditoria";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import { authedFetch } from "@/lib/adminFetch";
import {
  PRIORIDADE_LABELS,
  PRIORIDADE_OPTIONS,
  PRIORIDADE_BADGE_STYLES,
  STATUS_LABELS,
  ORIGEM_LABELS,
  RECORRENCIA_LABELS,
  ESTAGIOS_SUGERIDOS,
  CATEGORIA_LABELS,
  CATEGORIA_OPTIONS,
  CATEGORIA_PADRAO,
  calcularStatusLembrete,
} from "@/lib/lembretes";
import { STATUS_PAGAR_FINAIS, STATUS_RECEBER_FINAIS, calcularStatusVencimento, formatarMoeda } from "@/lib/financeiro";

const emptyForm = {
  titulo: "",
  descricao: "",
  categoria: CATEGORIA_PADRAO,
  dataAlerta: "",
  dataLimite: "",
  prioridade: "normal",
  recorrencia: "",
  estagiosDias: [],
  estagioCustom: "",
  compartilharCom: [],
};

const FILTROS_STATUS = [
  { id: "pendentes", label: "Pendentes" },
  { id: "atrasados", label: "Atrasados" },
  { id: "concluidos", label: "Concluídos" },
  { id: "todos", label: "Todos" },
];

const FILTROS_ORIGEM = [
  { id: "todas", label: "Todas as origens" },
  { id: "manual", label: "Manual" },
  { id: "manutencao", label: "Manutenção" },
  { id: "financeiro", label: "Financeiro" },
];

const FILTROS_CATEGORIA = [{ id: "todas", label: "Todas as categorias" }, ...CATEGORIA_OPTIONS.map((c) => ({ id: c, label: CATEGORIA_LABELS[c] }))];

function formatarDataBr(isoOuNulo) {
  if (!isoOuNulo) return "";
  const [ano, mes, dia] = isoOuNulo.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function LembretesPage() {
  const { condominio, user, member, role, temPermissao } = useAuth();
  const [lembretes, setLembretes] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [contasReceber, setContasReceber] = useState([]);
  const [membrosParaCompartilhar, setMembrosParaCompartilhar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("pendentes");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagemSync, setMensagemSync] = useState("");

  const podeCriar = temPermissao("lembretes", "criar");
  const podeEditarQualquer = temPermissao("lembretes", "editar");
  const podeExcluir = temPermissao("lembretes", "excluir");
  const podeFinanceiro = temPermissao("financeiro", "visualizar");

  // Além de quem tem "editar" liberado no módulo, quem criou o próprio
  // lembrete manual sempre pode concluir/cancelar o que criou (mesma
  // regra da RLS — ver policy de update em lembretes no schema). Um
  // lembrete espelho de Manutenção (sem criado_por_id) só é tocável por
  // quem tem "editar" (ou é o síndico).
  function podeGerenciar(item) {
    return role === "sindico" || podeEditarQualquer || (item.criado_por_id && item.criado_por_id === user?.id);
  }
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");

    const consultas = [
      supabase
        .from("lembretes")
        .select("*, lembretes_estagios(id, dias_antecedencia, data_disparo, processado_em)")
        .eq("condominio_id", condominio.id)
        .order("data_alerta", { ascending: true, nullsFirst: false }),
    ];

    if (podeFinanceiro) {
      consultas.push(
        supabase.from("contas_pagar").select("*").eq("condominio_id", condominio.id),
        supabase.from("contas_receber").select("*").eq("condominio_id", condominio.id)
      );
    }
    // Só o síndico (dono) enxerga a lista completa de membros (ver RLS de
    // "membros") — o seletor de compartilhamento só faz sentido pra ele.
    if (role === "sindico") {
      consultas.push(supabase.from("membros").select("id, nome, papel").eq("condominio_id", condominio.id));
    }

    const resultados = await Promise.all(consultas);
    const [lembretesResult, ...resto] = resultados;

    if (lembretesResult.error) setError(lembretesResult.error.message);
    else setLembretes(lembretesResult.data || []);

    let idx = 0;
    if (podeFinanceiro) {
      setContasPagar(resto[idx]?.data || []);
      idx++;
      setContasReceber(resto[idx]?.data || []);
      idx++;
    }
    if (role === "sindico") {
      setMembrosParaCompartilhar(resto[idx]?.data || []);
    }

    setLoading(false);
  }, [condominio?.id, podeFinanceiro, role]);

  useEffect(() => {
    load();
  }, [load]);

  // O processamento de verdade (criar/atualizar os lembretes espelho de
  // Manutenção, disparar estágios vencidos, mandar a cutuca de atraso)
  // roda 1x/dia sozinho pelo cron — este botão chama a mesma lógica na
  // hora, travada neste condomínio, só pra quem não quer esperar até o
  // próximo horário do cron pra ver o resultado.
  async function sincronizarAgora() {
    if (!condominio?.id) return;
    setSincronizando(true);
    setMensagemSync("");
    try {
      const res = await authedFetch("/api/lembretes/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condominioId: condominio.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao sincronizar.");
      setMensagemSync(
        `Sincronizado: ${data.espelhosSincronizados} ordem(ns) de manutenção, ${data.estagiosDisparados} aviso(s) enviado(s)${
          data.erros?.length ? ` — ${data.erros.length} erro(s), veja o console` : ""
        }.`
      );
      if (data.erros?.length) console.error("Erros ao sincronizar lembretes:", data.erros);
      load();
    } catch (err) {
      setMensagemSync(`Erro: ${err.message}`);
    } finally {
      setSincronizando(false);
    }
  }

  function toggleEstagio(dias) {
    setForm((f) => ({
      ...f,
      estagiosDias: f.estagiosDias.includes(dias) ? f.estagiosDias.filter((d) => d !== dias) : [...f.estagiosDias, dias],
    }));
  }

  function adicionarEstagioCustom() {
    const dias = Number(form.estagioCustom);
    if (!Number.isFinite(dias) || dias < 0) return;
    if (!form.estagiosDias.includes(dias)) {
      setForm((f) => ({ ...f, estagiosDias: [...f.estagiosDias, dias], estagioCustom: "" }));
    } else {
      setForm((f) => ({ ...f, estagioCustom: "" }));
    }
  }

  function toggleCompartilhar(membroId) {
    setForm((f) => ({
      ...f,
      compartilharCom: f.compartilharCom.includes(membroId)
        ? f.compartilharCom.filter((id) => id !== membroId)
        : [...f.compartilharCom, membroId],
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim() || !form.dataAlerta) return;

    setSubmitting(true);
    setError("");

    const { data: lembreteCriado, error: insertError } = await supabase
      .from("lembretes")
      .insert({
        condominio_id: condominio.id,
        origem: "manual",
        criado_por_id: user?.id || null,
        criado_por_nome: nomeUsuario,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria || CATEGORIA_PADRAO,
        data_alerta: form.dataAlerta,
        data_limite: form.dataLimite || null,
        prioridade: form.prioridade,
        recorrencia: form.recorrencia || null,
        visibilidade: form.compartilharCom.length > 0 ? "compartilhado" : "privado",
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    const tarefas = [];
    if (form.estagiosDias.length > 0) {
      const referencia = new Date(`${form.dataAlerta}T00:00:00`);
      const linhas = form.estagiosDias.map((dias) => {
        const disparo = new Date(referencia);
        disparo.setDate(disparo.getDate() - dias);
        return { lembrete_id: lembreteCriado.id, dias_antecedencia: dias, data_disparo: disparo.toISOString().slice(0, 10) };
      });
      tarefas.push(supabase.from("lembretes_estagios").insert(linhas));
    }
    if (form.compartilharCom.length > 0) {
      tarefas.push(
        supabase
          .from("lembretes_compartilhamentos")
          .insert(form.compartilharCom.map((membroId) => ({ lembrete_id: lembreteCriado.id, membro_id: membroId })))
      );
    }
    if (tarefas.length > 0) await Promise.all(tarefas);

    setForm(emptyForm);
    setMostrarForm(false);
    setSubmitting(false);
    load();
  }

  async function concluir(id) {
    await supabase
      .from("lembretes")
      .update({ status: "concluido", concluido_em: new Date().toISOString(), concluido_por_nome: nomeUsuario })
      .eq("id", id);
    load();
  }

  async function reabrir(id) {
    await supabase.from("lembretes").update({ status: "pendente", concluido_em: null, concluido_por_nome: null }).eq("id", id);
    load();
  }

  async function cancelar(id) {
    await supabase.from("lembretes").update({ status: "cancelado" }).eq("id", id);
    load();
  }

  // Financeiro nunca gera linha em `lembretes` (ver nota no cron) — essas
  // entradas são só uma leitura em tempo real, sempre "origem: financeiro",
  // sem id pra concluir/excluir por aqui (a ação de verdade é em Financeiro).
  const itensFinanceiro = useMemo(() => {
    if (!podeFinanceiro) return [];
    const pagar = contasPagar
      .filter((c) => !STATUS_PAGAR_FINAIS.includes(c.status))
      .map((c) => ({
      chave: `pagar-${c.id}`,
      origem: "financeiro",
      titulo: `A pagar: ${c.descricao}`,
      descricao: c.fornecedor_nome ? `Fornecedor: ${c.fornecedor_nome} · ${formatarMoeda(c.valor)}` : formatarMoeda(c.valor),
      data_alerta: c.data_vencimento,
      status: "pendente",
      categoria: "financeiro",
      prioridade: calcularStatusVencimento(c.data_vencimento, c.status, STATUS_PAGAR_FINAIS)?.nivel === "vermelho" ? "alta" : "normal",
      href: "/dashboard/financeiro?aba=visao",
      }));
    const receber = contasReceber
      .filter((c) => !STATUS_RECEBER_FINAIS.includes(c.status))
      .map((c) => ({
      chave: `receber-${c.id}`,
      origem: "financeiro",
      titulo: `A receber: ${c.descricao}`,
      descricao: formatarMoeda(c.valor),
      data_alerta: c.data_vencimento,
      status: "pendente",
      categoria: "financeiro",
      prioridade: calcularStatusVencimento(c.data_vencimento, c.status, STATUS_RECEBER_FINAIS)?.nivel === "vermelho" ? "alta" : "normal",
      href: "/dashboard/financeiro?aba=visao",
    }));
    return [...pagar, ...receber].filter((i) => i.data_alerta);
  }, [podeFinanceiro, contasPagar, contasReceber]);

  const todosOsItens = useMemo(() => {
    const manuaisEAutomaticos = lembretes.map((l) => ({ ...l, chave: l.id, href: l.origem === "manutencao" ? "/dashboard/manutencao" : null }));
    return [...manuaisEAutomaticos, ...itensFinanceiro];
  }, [lembretes, itensFinanceiro]);

  const itensFiltrados = useMemo(() => {
    return todosOsItens.filter((item) => {
      if (filtroOrigem !== "todas" && item.origem !== filtroOrigem) return false;
      if (filtroCategoria !== "todas" && (item.categoria || CATEGORIA_PADRAO) !== filtroCategoria) return false;
      const statusInfo = calcularStatusLembrete(item.data_alerta, item.status);
      if (filtroStatus === "pendentes") return item.status === "pendente";
      if (filtroStatus === "atrasados") return item.status === "pendente" && statusInfo?.atrasado;
      if (filtroStatus === "concluidos") return item.status === "concluido";
      return item.status !== "cancelado" || filtroStatus === "todos";
    });
  }, [todosOsItens, filtroStatus, filtroOrigem, filtroCategoria]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="lembretes">
      <div className="space-y-6">
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-navy-900">Lembretes</h1>
              <p className="mt-1 text-sm text-navy-500">
                Compromissos, vencimentos e alertas automáticos num só lugar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {podeCriar && (
                <button onClick={sincronizarAgora} disabled={sincronizando} className="btn-secondary text-sm disabled:opacity-50">
                  {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
                </button>
              )}
              {podeCriar && (
                <button onClick={() => setMostrarForm((v) => !v)} className="btn-primary text-sm">
                  {mostrarForm ? "Cancelar" : "+ Novo lembrete"}
                </button>
              )}
            </div>
          </div>
          {mensagemSync && <p className="mt-2 text-xs text-navy-500">{mensagemSync}</p>}

          {mostrarForm && podeCriar && (
            <form onSubmit={handleCreate} className="mt-4 space-y-3 border-t border-navy-100 pt-4">
              <div>
                <label className="label-field">Título</label>
                <input
                  className="input-field"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Renovar contrato de portaria"
                  required
                />
              </div>
              <div>
                <label className="label-field">Descrição (opcional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Categoria</label>
                <select
                  className="input-field"
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                >
                  {CATEGORIA_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Data do alerta</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.dataAlerta}
                    onChange={(e) => setForm((f) => ({ ...f, dataAlerta: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Data limite (opcional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.dataLimite}
                    onChange={(e) => setForm((f) => ({ ...f, dataLimite: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Prioridade</label>
                  <select
                    className="input-field"
                    value={form.prioridade}
                    onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                  >
                    {PRIORIDADE_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {PRIORIDADE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Recorrência (opcional)</label>
                  <select
                    className="input-field"
                    value={form.recorrencia}
                    onChange={(e) => setForm((f) => ({ ...f, recorrencia: e.target.value }))}
                  >
                    <option value="">Nenhuma</option>
                    {Object.entries(RECORRENCIA_LABELS).map(([valor, label]) => (
                      <option key={valor} value={valor}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label-field">Avisar com antecedência de (opcional, pode marcar vários)</label>
                <div className="flex flex-wrap gap-2">
                  {ESTAGIOS_SUGERIDOS.map((e) => (
                    <label
                      key={e.dias}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
                        form.estagiosDias.includes(e.dias)
                          ? "border-coral bg-coral-50 text-coral-700"
                          : "border-navy-100 text-navy-600"
                      }`}
                    >
                      <input type="checkbox" className="hidden" checked={form.estagiosDias.includes(e.dias)} onChange={() => toggleEstagio(e.dias)} />
                      {e.label}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    className="input-field w-32"
                    placeholder="Outro (dias)"
                    value={form.estagioCustom}
                    onChange={(e) => setForm((f) => ({ ...f, estagioCustom: e.target.value }))}
                  />
                  <button type="button" onClick={adicionarEstagioCustom} className="btn-secondary text-xs">
                    Adicionar
                  </button>
                  {form.estagiosDias.length > 0 && (
                    <span className="text-xs text-navy-400">
                      Estágios: {form.estagiosDias.sort((a, b) => b - a).join(", ")} dia(s) antes
                    </span>
                  )}
                </div>
              </div>

              {role === "sindico" && membrosParaCompartilhar.length > 0 && (
                <div>
                  <label className="label-field">Compartilhar com (opcional — privado por padrão)</label>
                  <div className="flex flex-wrap gap-2">
                    {membrosParaCompartilhar.map((m) => (
                      <label
                        key={m.id}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
                          form.compartilharCom.includes(m.id)
                            ? "border-coral bg-coral-50 text-coral-700"
                            : "border-navy-100 text-navy-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={form.compartilharCom.includes(m.id)}
                          onChange={() => toggleCompartilhar(m.id)}
                        />
                        {m.nome}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-coral-700">{error}</p>}
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Salvando..." : "Criar lembrete"}
              </button>
            </form>
          )}
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {FILTROS_STATUS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroStatus(f.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    filtroStatus === f.id ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-600"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select className="input-field w-auto" value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)}>
              {FILTROS_ORIGEM.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select className="input-field w-auto" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              {FILTROS_CATEGORIA.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-coral-700">{error}</p>}

        {loading ? (
          <p className="text-navy-500">Carregando lembretes...</p>
        ) : itensFiltrados.length === 0 ? (
          <div className="card text-center text-navy-400">Nenhum lembrete nesse filtro.</div>
        ) : (
          <div className="space-y-3">
            {itensFiltrados.map((item) => {
              const statusInfo = calcularStatusLembrete(item.data_alerta, item.status);
              const estagios = item.lembretes_estagios || [];
              return (
                <div
                  key={item.chave}
                  className={`card flex flex-col gap-2 ${statusInfo?.nivel === "vermelho" ? "border-coral-200 bg-coral-50/30" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy-900">{item.titulo}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORIDADE_BADGE_STYLES[item.prioridade] || ""}`}>
                          {PRIORIDADE_LABELS[item.prioridade] || item.prioridade}
                        </span>
                        <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-600">
                          {ORIGEM_LABELS[item.origem] || item.origem}
                        </span>
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                          {CATEGORIA_LABELS[item.categoria] || CATEGORIA_LABELS[CATEGORIA_PADRAO]}
                        </span>
                        {statusInfo && (
                          <span className="text-xs">
                            {statusInfo.emoji} {statusInfo.label}
                          </span>
                        )}
                        {item.status !== "pendente" && (
                          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs text-navy-500">{STATUS_LABELS[item.status]}</span>
                        )}
                      </div>
                      {item.descricao && <p className="mt-1 text-sm text-navy-600">{item.descricao}</p>}
                      <p className="mt-1 text-xs text-navy-400">
                        {item.data_alerta && `Alerta: ${formatarDataBr(item.data_alerta)}`}
                        {item.data_limite && item.data_limite !== item.data_alerta && ` · Limite: ${formatarDataBr(item.data_limite)}`}
                        {item.criado_por_nome && ` · Criado por ${item.criado_por_nome}`}
                        {estagios.length > 0 && ` · Avisos: ${estagios.map((e) => `${e.dias_antecedencia}d`).join(", ")}`}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-3">
                      {item.href && (
                        <Link href={item.href} className="text-xs font-semibold text-navy-700 hover:underline">
                          Ver origem
                        </Link>
                      )}
                      {item.id && item.status === "pendente" && podeGerenciar(item) && (
                        <>
                          <button onClick={() => concluir(item.id)} className="text-xs font-semibold text-emerald-700 hover:underline">
                            Concluir
                          </button>
                          <button onClick={() => cancelar(item.id)} className="text-xs font-semibold text-navy-500 hover:underline">
                            Cancelar
                          </button>
                        </>
                      )}
                      {item.id && item.status === "concluido" && podeGerenciar(item) && (
                        <button onClick={() => reabrir(item.id)} className="text-xs font-semibold text-navy-500 hover:underline">
                          Reabrir
                        </button>
                      )}
                      {item.id && item.origem === "manual" && podeExcluir && (
                        <BotaoExcluirComAuditoria
                          tabela="lembretes"
                          modulo="lembretes"
                          registroId={item.id}
                          descricao="este lembrete"
                          onExcluido={load}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModuloGuard>
  );
}
