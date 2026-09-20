"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { getPlan } from "@/lib/plans";
import { STATUS_FINAIS as CHAMADOS_STATUS_FINAIS, calcularStatusPrazo } from "@/lib/chamados";
import { STATUS_PAGAR_FINAIS, STATUS_RECEBER_FINAIS, calcularStatusVencimento, formatarMoeda } from "@/lib/financeiro";
import { PERIODO_OPTIONS, calcularIntervaloPeriodo, dentroDoIntervalo, formatarIntervalo } from "@/lib/periodo";

const nextSteps = [
  {
    title: "Dar acesso a condôminos e equipe",
    description: "Crie logins delimitados: condômino, porteiro ou conselheiro.",
    href: "/dashboard/acessos",
    cta: "Criar acesso",
  },
  {
    title: "Publicar um aviso",
    description: "Envie um comunicado para todos os condôminos.",
    href: "/dashboard/avisos",
    cta: "Publicar aviso",
  },
  {
    title: "Abrir um chamado de teste",
    description: "Veja como fica o acompanhamento de solicitações.",
    href: "/dashboard/chamados",
    cta: "Ver chamados",
  },
  {
    title: "Ver tutorial",
    description: "Um vídeo de 3 minutos mostrando o básico da plataforma.",
    href: "#",
    cta: "Assistir",
  },
];

const quickActions = [
  { label: "Novo Chamado", href: "/dashboard/chamados" },
  { label: "Novo Aviso", href: "/dashboard/avisos" },
  { label: "Acessos", href: "/dashboard/acessos" },
];

// Indicador clicável — leva direto pro módulo quando clicado.
function Indicador({ href, label, value, tone = "text-navy-900" }) {
  return (
    <Link href={href} className="card block transition hover:border-coral-200 hover:shadow-sm">
      <p className="text-xs text-navy-400">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</p>
    </Link>
  );
}

export default function DashboardContent() {
  const { condominio, temPermissao } = useAuth();
  const [indicadores, setIndicadores] = useState(null);
  const [periodo, setPeriodo] = useState("mes_atual");
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState({ inicio: "", fim: "" });

  const podeChamados = temPermissao("chamados", "visualizar");
  const podeManutencao = temPermissao("manutencao", "visualizar");
  const podeFinanceiro = temPermissao("financeiro", "visualizar");
  const podeFornecedores = temPermissao("fornecedores", "visualizar");
  const podePropostas = temPermissao("propostas", "visualizar");
  const podeColaboradores = temPermissao("colaboradores", "visualizar");
  const podeOcorrencias = temPermissao("ocorrencias", "visualizar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;

    const queries = {};
    if (podeChamados) {
      queries.chamados = supabase
        .from("chamados")
        .select("status, data_prevista, created_at, data_conclusao, responsavel_id, responsavel_colaborador_id, ocorrencia_origem_id")
        .eq("condominio_id", condominio.id);
    }
    if (podeManutencao) {
      queries.manutencoes = supabase
        .from("manutencoes")
        .select("status, data_prevista, responsavel_colaborador_id")
        .eq("condominio_id", condominio.id);
    }
    if (podeFinanceiro) {
      queries.contasPagar = supabase.from("contas_pagar").select("status, valor, data_vencimento, data_pagamento").eq("condominio_id", condominio.id);
      queries.contasReceber = supabase.from("contas_receber").select("status, valor, valor_recebido, data_vencimento, data_recebimento").eq("condominio_id", condominio.id);
    }
    if (podeFornecedores) queries.fornecedores = supabase.from("fornecedores").select("status").eq("condominio_id", condominio.id);
    if (podePropostas) queries.propostas = supabase.from("propostas").select("status").eq("condominio_id", condominio.id);
    if (podeColaboradores) queries.colaboradores = supabase.from("colaboradores").select("status").eq("condominio_id", condominio.id);
    if (podeOcorrencias) queries.ocorrencias = supabase.from("ocorrencias").select("id").eq("condominio_id", condominio.id);
    // Conta moradores (papel "condômino") de fato cadastrados em Acessos —
    // o campo condominios.unidades_ativas nunca é atualizado automaticamente,
    // então usamos a contagem real em vez dele.
    queries.condominos = supabase
      .from("membros")
      .select("id")
      .eq("condominio_id", condominio.id)
      .eq("papel", "condomino");

    const chaves = Object.keys(queries);
    const resultados = await Promise.all(chaves.map((k) => queries[k]));
    const dados = {};
    chaves.forEach((k, i) => {
      dados[k] = resultados[i].data || [];
    });
    setIndicadores(dados);
  }, [condominio?.id, podeChamados, podeManutencao, podeFinanceiro, podeFornecedores, podePropostas, podeColaboradores, podeOcorrencias]);

  useEffect(() => {
    load();
  }, [load]);

  // Mocked fallback so the dashboard is always usable, even before
  // Supabase is configured or while the condominio row is still loading.
  const data = condominio || {
    nome: "Seu condomínio",
    plano: "growth",
    unidades_limite: 100,
  };

  const plan = getPlan(data.plano);
  const unidadesAtivas = indicadores?.condominos?.length ?? 0;

  const intervalo = calcularIntervaloPeriodo(periodo, periodoPersonalizado);

  const chamadosAbertos = indicadores?.chamados?.filter((c) => !CHAMADOS_STATUS_FINAIS.includes(c.status)) || [];
  const chamadosAtrasados = chamadosAbertos.filter((c) => calcularStatusPrazo(c.data_prevista, c.status)?.atrasado);
  const chamadosEmAtendimento = indicadores?.chamados?.filter((c) => c.status === "em_atendimento") || [];
  const chamadosSemResponsavel = chamadosAbertos.filter((c) => !c.responsavel_id && !c.responsavel_colaborador_id);

  const manutencoesAbertas = indicadores?.manutencoes?.filter((m) => m.status !== "concluida") || [];
  const manutencoesAtrasadas = manutencoesAbertas.filter(
    (m) => calcularStatusPrazo(m.data_prevista, m.status, ["concluida"])?.nivel === "vermelho"
  );
  const manutencoesEmAndamento = indicadores?.manutencoes?.filter((m) => m.status === "em_andamento") || [];
  const hojeStr = new Date().toISOString().slice(0, 10);
  const manutencoesHoje = manutencoesAbertas.filter((m) => m.data_prevista === hojeStr);

  const contasPagarAbertas = indicadores?.contasPagar?.filter((c) => !STATUS_PAGAR_FINAIS.includes(c.status)) || [];
  const contasReceberAbertas = indicadores?.contasReceber?.filter((c) => !STATUS_RECEBER_FINAIS.includes(c.status)) || [];
  const contasVencidas =
    (indicadores?.contasPagar?.filter((c) => calcularStatusVencimento(c.data_vencimento, c.status, STATUS_PAGAR_FINAIS)?.nivel === "vermelho").length || 0) +
    (indicadores?.contasReceber?.filter((c) => calcularStatusVencimento(c.data_vencimento, c.status, STATUS_RECEBER_FINAIS)?.nivel === "vermelho").length || 0);
  const contasAVencerEmBreve =
    (indicadores?.contasPagar?.filter((c) => calcularStatusVencimento(c.data_vencimento, c.status, STATUS_PAGAR_FINAIS)?.nivel === "amarelo").length || 0) +
    (indicadores?.contasReceber?.filter((c) => calcularStatusVencimento(c.data_vencimento, c.status, STATUS_RECEBER_FINAIS)?.nivel === "amarelo").length || 0);
  const receitasDoPeriodo = (indicadores?.contasReceber || [])
    .filter((c) => c.status === "recebida" && dentroDoIntervalo(c.data_recebimento, intervalo))
    .reduce((s, c) => s + Number(c.valor_recebido ?? c.valor ?? 0), 0);
  const despesasDoPeriodo = (indicadores?.contasPagar || [])
    .filter((c) => c.status === "pago" && dentroDoIntervalo(c.data_pagamento, intervalo))
    .reduce((s, c) => s + Number(c.valor || 0), 0);

  const fornecedoresAtivos = indicadores?.fornecedores?.filter((f) => f.status === "ativo") || [];
  const fornecedoresEmAvaliacao = indicadores?.fornecedores?.filter((f) => f.status === "em_avaliacao") || [];

  const propostasPendentes = indicadores?.propostas?.filter((p) => p.status === "pendente") || [];

  const colaboradoresAtivos = indicadores?.colaboradores?.filter((c) => c.status === "ativo") || [];

  // Ocorrência "precisa de atenção" = ainda não gerou nenhum chamado — não
  // existe campo de status (aberta/encerrada) na tabela hoje, então usamos
  // esse vínculo real em vez de inventar um campo novo.
  const idsOcorrenciasComChamado = new Set(
    (indicadores?.chamados || []).map((c) => c.ocorrencia_origem_id).filter(Boolean)
  );
  const ocorrenciasSemChamado = (indicadores?.ocorrencias || []).filter((o) => !idsOcorrenciasComChamado.has(o.id));

  const tarefasColaboradoresAbertas =
    chamadosAbertos.filter((c) => c.responsavel_colaborador_id).length +
    manutencoesAbertas.filter((m) => m.responsavel_colaborador_id).length;

  // Indicadores derivados (seção 10 do prompt de evolução): taxa de
  // conclusão/atraso/resposta e tempo médio de atendimento dos chamados.
  // "Respondido" = saiu do status inicial "aberto" (não existe um campo
  // de primeira resposta separado hoje).
  const totalChamados = indicadores?.chamados?.length || 0;
  const chamadosConcluidos = indicadores?.chamados?.filter((c) => c.status === "concluido") || [];
  const chamadosComPrazo = indicadores?.chamados?.filter((c) => c.data_prevista) || [];
  const chamadosRespondidos = indicadores?.chamados?.filter((c) => c.status !== "aberto") || [];
  const taxaConclusao = totalChamados ? Math.round((chamadosConcluidos.length / totalChamados) * 100) : null;
  const taxaAtraso = chamadosComPrazo.length
    ? Math.round((chamadosAtrasados.length / chamadosComPrazo.length) * 100)
    : null;
  const taxaResposta = totalChamados ? Math.round((chamadosRespondidos.length / totalChamados) * 100) : null;
  const chamadosConcluidosComData = chamadosConcluidos.filter((c) => c.data_conclusao && c.created_at);
  const tempoMedioDias = chamadosConcluidosComData.length
    ? (
        chamadosConcluidosComData.reduce(
          (soma, c) => soma + (new Date(c.data_conclusao) - new Date(c.created_at)) / 86400000,
          0
        ) / chamadosConcluidosComData.length
      ).toFixed(1)
    : null;

  const alertas = [
    { href: "/dashboard/chamados", label: "Chamados atrasados", qtd: chamadosAtrasados.length, visivel: podeChamados },
    {
      href: "/dashboard/chamados",
      label: "Chamados sem responsável",
      qtd: chamadosSemResponsavel.length,
      visivel: podeChamados,
    },
    {
      href: "/dashboard/manutencao",
      label: "Manutenções atrasadas",
      qtd: manutencoesAtrasadas.length,
      visivel: podeManutencao,
    },
    {
      href: "/dashboard/manutencao",
      label: "Manutenções previstas para hoje",
      qtd: manutencoesHoje.length,
      visivel: podeManutencao,
    },
    { href: "/dashboard/financeiro?aba=visao", label: "Contas vencidas", qtd: contasVencidas, visivel: podeFinanceiro },
    {
      href: "/dashboard/financeiro?aba=visao",
      label: "Contas próximas do vencimento",
      qtd: contasAVencerEmBreve,
      visivel: podeFinanceiro,
    },
    {
      href: "/dashboard/propostas",
      label: "Propostas aguardando aprovação",
      qtd: propostasPendentes.length,
      visivel: podePropostas,
    },
    {
      href: "/dashboard/ocorrencias",
      label: "Ocorrências sem chamado gerado",
      qtd: ocorrenciasSemChamado.length,
      visivel: podeOcorrencias,
    },
    {
      href: "/dashboard/colaboradores",
      label: "Tarefas de colaboradores em aberto",
      qtd: tarefasColaboradoresAbertas,
      visivel: podeColaboradores,
    },
  ].filter((a) => a.visivel && a.qtd > 0);

  return (
    <div className="space-y-8">
      <section className="card">
        <p className="text-sm font-medium text-navy-400">Seu condomínio</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy-900">{data.nome}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-navy-600">
          <span>
            Plano: <strong className="text-navy-900">{plan.name}</strong> (R$ {plan.price}
            /mês)
          </span>
          <span>
            Unidades: <strong className="text-navy-900">{unidadesAtivas}</strong>/
            {data.unidades_limite}
          </span>
        </div>
      </section>

      {podeFinanceiro && (
        <section className="card">
          <div className="flex flex-wrap items-center gap-3">
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
          <p className="mt-1 text-xs text-navy-400">Afeta os indicadores financeiros abaixo.</p>
        </section>
      )}

      {alertas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-coral-700">
            O que precisa de atenção
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {alertas.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="card flex items-center justify-between gap-3 border-coral-100 bg-coral-50/40 transition hover:border-coral-300 hover:shadow-sm"
              >
                <span className="text-sm font-medium text-navy-700">{a.label}</span>
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-coral px-2 text-sm font-bold text-white">
                  {a.qtd}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {podeChamados && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Chamados</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador href="/dashboard/chamados" label="Abertos" value={chamadosAbertos.length} />
            <Indicador href="/dashboard/chamados" label="Atrasados" value={chamadosAtrasados.length} tone="text-coral-700" />
            <Indicador href="/dashboard/chamados" label="Em atendimento" value={chamadosEmAtendimento.length} />
            <Indicador href="/dashboard/chamados" label="Sem responsável" value={chamadosSemResponsavel.length} />
            <Indicador
              href="/dashboard/chamados"
              label="Taxa de conclusão"
              value={taxaConclusao != null ? `${taxaConclusao}%` : "-"}
            />
            <Indicador
              href="/dashboard/chamados"
              label="Taxa de resposta"
              value={taxaResposta != null ? `${taxaResposta}%` : "-"}
            />
            <Indicador
              href="/dashboard/chamados"
              label="Taxa de atraso"
              value={taxaAtraso != null ? `${taxaAtraso}%` : "-"}
              tone="text-coral-700"
            />
            <Indicador
              href="/dashboard/chamados"
              label="Tempo médio de atendimento"
              value={tempoMedioDias ? `${tempoMedioDias} dias` : "-"}
            />
          </div>
        </section>
      )}

      {podeManutencao && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Manutenção</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador href="/dashboard/manutencao" label="Em aberto" value={manutencoesAbertas.length} />
            <Indicador href="/dashboard/manutencao" label="Atrasadas" value={manutencoesAtrasadas.length} tone="text-coral-700" />
            <Indicador href="/dashboard/manutencao" label="Em andamento" value={manutencoesEmAndamento.length} />
          </div>
        </section>
      )}

      {podeFinanceiro && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Financeiro</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador href="/dashboard/financeiro?aba=visao" label="Receitas no período" value={formatarMoeda(receitasDoPeriodo)} tone="text-emerald-700" />
            <Indicador href="/dashboard/financeiro?aba=visao" label="Despesas no período" value={formatarMoeda(despesasDoPeriodo)} tone="text-coral-700" />
            <Indicador href="/dashboard/financeiro?aba=visao" label="Saldo no período" value={formatarMoeda(receitasDoPeriodo - despesasDoPeriodo)} />
            <Indicador href="/dashboard/financeiro?aba=pagar" label="Contas a pagar" value={contasPagarAbertas.length} />
            <Indicador href="/dashboard/financeiro?aba=receber" label="Contas a receber" value={contasReceberAbertas.length} />
            <Indicador href="/dashboard/financeiro?aba=visao" label="Contas vencidas" value={contasVencidas} tone="text-coral-700" />
          </div>
        </section>
      )}

      {podeFornecedores && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Fornecedores</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador href="/dashboard/fornecedores" label="Ativos" value={fornecedoresAtivos.length} />
            <Indicador href="/dashboard/fornecedores" label="Em avaliação" value={fornecedoresEmAvaliacao.length} />
          </div>
        </section>
      )}

      {podePropostas && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Propostas</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador href="/dashboard/propostas" label="Aguardando aprovação" value={propostasPendentes.length} />
          </div>
        </section>
      )}

      {podeColaboradores && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Colaboradores</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador href="/dashboard/colaboradores" label="Ativos" value={colaboradoresAtivos.length} />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Próximos passos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {nextSteps.map((step, i) => (
            <div key={step.title} className="card flex items-start gap-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-midnight text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-navy-900">{step.title}</h3>
                <p className="mt-1 text-sm text-navy-500">{step.description}</p>
                <Link
                  href={step.href}
                  className="mt-3 inline-block text-sm font-semibold text-coral hover:underline"
                >
                  {step.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">
          Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} className="btn-primary">
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
