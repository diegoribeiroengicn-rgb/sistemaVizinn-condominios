"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { getPlan } from "@/lib/plans";
import { STATUS_FINAIS as CHAMADOS_STATUS_FINAIS, calcularStatusPrazo } from "@/lib/chamados";
import { STATUS_PAGAR_FINAIS, STATUS_RECEBER_FINAIS, calcularStatusVencimento, formatarMoeda } from "@/lib/financeiro";

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

  const podeChamados = temPermissao("chamados", "visualizar");
  const podeManutencao = temPermissao("manutencao", "visualizar");
  const podeFinanceiro = temPermissao("financeiro", "visualizar");
  const podeFornecedores = temPermissao("fornecedores", "visualizar");
  const podePropostas = temPermissao("propostas", "visualizar");
  const podeColaboradores = temPermissao("colaboradores", "visualizar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;

    const queries = {};
    if (podeChamados) queries.chamados = supabase.from("chamados").select("status, data_prevista").eq("condominio_id", condominio.id);
    if (podeManutencao) queries.manutencoes = supabase.from("manutencoes").select("status, data_prevista").eq("condominio_id", condominio.id);
    if (podeFinanceiro) {
      queries.contasPagar = supabase.from("contas_pagar").select("status, valor, data_vencimento, data_pagamento").eq("condominio_id", condominio.id);
      queries.contasReceber = supabase.from("contas_receber").select("status, valor, valor_recebido, data_vencimento, data_recebimento").eq("condominio_id", condominio.id);
    }
    if (podeFornecedores) queries.fornecedores = supabase.from("fornecedores").select("status").eq("condominio_id", condominio.id);
    if (podePropostas) queries.propostas = supabase.from("propostas").select("status").eq("condominio_id", condominio.id);
    if (podeColaboradores) queries.colaboradores = supabase.from("colaboradores").select("status").eq("condominio_id", condominio.id);
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
  }, [condominio?.id, podeChamados, podeManutencao, podeFinanceiro, podeFornecedores, podePropostas, podeColaboradores]);

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

  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const chamadosAbertos = indicadores?.chamados?.filter((c) => !CHAMADOS_STATUS_FINAIS.includes(c.status)) || [];
  const chamadosAtrasados = chamadosAbertos.filter((c) => calcularStatusPrazo(c.data_prevista, c.status)?.atrasado);
  const chamadosEmAtendimento = indicadores?.chamados?.filter((c) => c.status === "em_atendimento") || [];

  const manutencoesAbertas = indicadores?.manutencoes?.filter((m) => m.status !== "concluida") || [];
  const manutencoesAtrasadas = manutencoesAbertas.filter(
    (m) => calcularStatusPrazo(m.data_prevista, m.status, ["concluida"])?.nivel === "vermelho"
  );
  const manutencoesEmAndamento = indicadores?.manutencoes?.filter((m) => m.status === "em_andamento") || [];

  const contasPagarAbertas = indicadores?.contasPagar?.filter((c) => !STATUS_PAGAR_FINAIS.includes(c.status)) || [];
  const contasReceberAbertas = indicadores?.contasReceber?.filter((c) => !STATUS_RECEBER_FINAIS.includes(c.status)) || [];
  const contasVencidas =
    (indicadores?.contasPagar?.filter((c) => calcularStatusVencimento(c.data_vencimento, c.status, STATUS_PAGAR_FINAIS)?.nivel === "vermelho").length || 0) +
    (indicadores?.contasReceber?.filter((c) => calcularStatusVencimento(c.data_vencimento, c.status, STATUS_RECEBER_FINAIS)?.nivel === "vermelho").length || 0);
  const receitasDoMes = (indicadores?.contasReceber || [])
    .filter((c) => c.status === "recebida" && c.data_recebimento && new Date(c.data_recebimento) >= inicioDoMes)
    .reduce((s, c) => s + Number(c.valor_recebido ?? c.valor ?? 0), 0);
  const despesasDoMes = (indicadores?.contasPagar || [])
    .filter((c) => c.status === "pago" && c.data_pagamento && new Date(c.data_pagamento) >= inicioDoMes)
    .reduce((s, c) => s + Number(c.valor || 0), 0);

  const fornecedoresAtivos = indicadores?.fornecedores?.filter((f) => f.status === "ativo") || [];
  const fornecedoresEmAvaliacao = indicadores?.fornecedores?.filter((f) => f.status === "em_avaliacao") || [];

  const propostasPendentes = indicadores?.propostas?.filter((p) => p.status === "pendente") || [];

  const colaboradoresAtivos = indicadores?.colaboradores?.filter((c) => c.status === "ativo") || [];

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

      {podeChamados && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Chamados</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador href="/dashboard/chamados" label="Abertos" value={chamadosAbertos.length} />
            <Indicador href="/dashboard/chamados" label="Atrasados" value={chamadosAtrasados.length} tone="text-coral-700" />
            <Indicador href="/dashboard/chamados" label="Em atendimento" value={chamadosEmAtendimento.length} />
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
            <Indicador href="/dashboard/financeiro?aba=visao" label="Receitas do mês" value={formatarMoeda(receitasDoMes)} tone="text-emerald-700" />
            <Indicador href="/dashboard/financeiro?aba=visao" label="Despesas do mês" value={formatarMoeda(despesasDoMes)} tone="text-coral-700" />
            <Indicador href="/dashboard/financeiro?aba=visao" label="Saldo do mês" value={formatarMoeda(receitasDoMes - despesasDoMes)} />
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
