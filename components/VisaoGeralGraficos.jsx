"use client";

// Gráficos da Visão Geral — sempre a partir de dados reais já carregados
// pelo DashboardContent (nunca inventa valor). Barras horizontais simples
// em SVG (sem depender de biblioteca externa), seguindo o mesmo padrão de
// cor de estado já usado nos badges do resto do sistema (coral = crítico/
// atrasado, âmbar = atenção, esmeralda = concluído/em dia, navy = neutro).
import { useMemo } from "react";
import { STATUS_LABELS as CHAMADOS_STATUS_LABELS, STATUS_ORDER as CHAMADOS_STATUS_ORDER } from "@/lib/chamados";
import {
  STATUS_PAGAR_LABELS,
  STATUS_PAGAR_ORDER,
  STATUS_PAGAR_FINAIS,
  calcularStatusVencimento,
  formatarMoeda,
} from "@/lib/financeiro";
import { dentroDoIntervalo } from "@/lib/periodo";

const CHAMADOS_STATUS_COR = {
  aberto: "fill-coral",
  em_analise: "fill-amber-500",
  em_atendimento: "fill-amber-500",
  aguardando_informacao: "fill-navy-300",
  aguardando_morador: "fill-navy-300",
  aguardando_prestador: "fill-navy-300",
  aguardando_aprovacao: "fill-navy-300",
  concluido: "fill-emerald-500",
  cancelado: "fill-navy-200",
};

const MANUTENCAO_STATUS = ["aberta", "em_andamento", "concluida"];
const MANUTENCAO_STATUS_LABELS = { aberta: "Aberta", em_andamento: "Em andamento", concluida: "Concluída" };
const MANUTENCAO_STATUS_COR = { aberta: "fill-coral", em_andamento: "fill-amber-500", concluida: "fill-emerald-500" };

const CONTAS_STATUS_COR = {
  pendente: "fill-navy-300",
  a_vencer: "fill-amber-500",
  vencida: "fill-coral",
  pago: "fill-emerald-500",
  cancelada: "fill-navy-200",
};

function Painel({ titulo, subtitulo, children, vazio }) {
  return (
    <div className="card">
      <h3 className="font-display text-base font-bold text-navy-900">{titulo}</h3>
      {subtitulo && <p className="text-xs text-navy-400">{subtitulo}</p>}
      <div className="mt-4">
        {vazio ? (
          <p className="text-sm text-navy-400">Dados insuficientes para gerar este gráfico.</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// Barras horizontais — uma por item, cor conforme o estado, valor sempre
// visível ao lado (nunca só a cor carregando o significado).
function BarrasHorizontais({ itens, formatarValor = (v) => v }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="space-y-2">
      {itens.map((item) => (
        <div key={item.label} className="flex items-center gap-3" title={`${item.label}: ${formatarValor(item.valor)}`}>
          <span className="w-36 flex-none truncate text-xs text-navy-600">{item.label}</span>
          <svg viewBox="0 0 100 10" className="h-2.5 flex-1 overflow-visible" preserveAspectRatio="none">
            <rect x="0" y="0" width="100" height="10" rx="5" className="fill-navy-50" />
            {item.valor > 0 && (
              <rect x="0" y="0" width={Math.max(4, (item.valor / max) * 100)} height="10" rx="5" className={item.corClass} />
            )}
          </svg>
          <span className="w-14 flex-none text-right text-xs font-semibold text-navy-800">
            {formatarValor(item.valor)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Barras verticais simples — pra série ao longo do tempo (últimos 6 meses).
function BarrasVerticais({ itens }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="flex items-end gap-2" style={{ height: 120 }}>
      {itens.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-1" title={`${item.label}: ${item.valor}`}>
          <span className="text-xs font-semibold text-navy-700">{item.valor}</span>
          <div
            className="w-full rounded-t-md bg-navy-400"
            style={{ height: Math.max(4, (item.valor / max) * 90) }}
          />
          <span className="text-[10px] text-navy-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function bucketsUltimosMeses(quantidade) {
  const hoje = new Date();
  const buckets = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    buckets.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-BR", { month: "short" }) });
  }
  return buckets;
}

export default function VisaoGeralGraficos({ indicadores, intervalo, podeChamados, podeManutencao, podeFinanceiro }) {
  const chamadosNoPeriodo = useMemo(
    () => (indicadores?.chamados || []).filter((c) => dentroDoIntervalo(c.created_at, intervalo)),
    [indicadores?.chamados, intervalo]
  );
  const manutencoesNoPeriodo = useMemo(
    () => (indicadores?.manutencoes || []).filter((m) => dentroDoIntervalo(m.created_at, intervalo)),
    [indicadores?.manutencoes, intervalo]
  );

  const chamadosPorStatus = CHAMADOS_STATUS_ORDER.map((status) => ({
    label: CHAMADOS_STATUS_LABELS[status],
    valor: chamadosNoPeriodo.filter((c) => c.status === status).length,
    corClass: CHAMADOS_STATUS_COR[status],
  }));

  const totalChamadosPeriodo = chamadosNoPeriodo.length;
  const respondidos = chamadosNoPeriodo.filter((c) => c.status !== "aberto").length;
  const naoRespondidos = totalChamadosPeriodo - respondidos;
  const percentualResposta = totalChamadosPeriodo ? Math.round((respondidos / totalChamadosPeriodo) * 100) : null;

  const evolucaoChamados = useMemo(() => {
    const buckets = bucketsUltimosMeses(6);
    const contagem = {};
    for (const b of buckets) contagem[b.chave] = 0;
    for (const c of indicadores?.chamados || []) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const chave = `${d.getFullYear()}-${d.getMonth()}`;
      if (chave in contagem) contagem[chave] += 1;
    }
    return buckets.map((b) => ({ label: b.label, valor: contagem[b.chave] }));
  }, [indicadores?.chamados]);

  const manutencaoPorStatus = MANUTENCAO_STATUS.map((status) => ({
    label: MANUTENCAO_STATUS_LABELS[status],
    valor: manutencoesNoPeriodo.filter((m) => m.status === status).length,
    corClass: MANUTENCAO_STATUS_COR[status],
  }));

  const receitasDespesas = [
    {
      label: "Receitas",
      valor: (indicadores?.contasReceber || [])
        .filter((c) => c.status === "recebida" && dentroDoIntervalo(c.data_recebimento, intervalo))
        .reduce((s, c) => s + Number(c.valor_recebido ?? c.valor ?? 0), 0),
      corClass: "fill-emerald-500",
    },
    {
      label: "Despesas",
      valor: (indicadores?.contasPagar || [])
        .filter((c) => c.status === "pago" && dentroDoIntervalo(c.data_pagamento, intervalo))
        .reduce((s, c) => s + Number(c.valor || 0), 0),
      corClass: "fill-coral",
    },
  ];

  const contasPagarPorStatus = STATUS_PAGAR_ORDER.map((status) => ({
    label: STATUS_PAGAR_LABELS[status],
    valor: (indicadores?.contasPagar || []).filter((c) => {
      if (status === "vencida") {
        return calcularStatusVencimento(c.data_vencimento, c.status, STATUS_PAGAR_FINAIS)?.nivel === "vermelho";
      }
      return c.status === status;
    }).length,
    corClass: CONTAS_STATUS_COR[status],
  }));

  if (!podeChamados && !podeManutencao && !podeFinanceiro) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Gráficos e análises</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {podeChamados && (
          <Painel
            titulo="Chamados por status"
            subtitulo={intervalo ? "No período selecionado" : "Selecione um período"}
            vazio={totalChamadosPeriodo === 0}
          >
            <BarrasHorizontais itens={chamadosPorStatus} />
          </Painel>
        )}

        {podeChamados && (
          <Painel
            titulo="Respondidos x Não respondidos"
            subtitulo={intervalo ? "No período selecionado" : "Selecione um período"}
            vazio={totalChamadosPeriodo === 0}
          >
            <div className="space-y-3">
              <BarrasHorizontais
                itens={[
                  { label: "Respondidos", valor: respondidos, corClass: "fill-emerald-500" },
                  { label: "Não respondidos", valor: naoRespondidos, corClass: "fill-coral" },
                ]}
              />
              <p className="text-xs text-navy-500">
                Total: <strong>{totalChamadosPeriodo}</strong> · Taxa de resposta:{" "}
                <strong>{percentualResposta != null ? `${percentualResposta}%` : "-"}</strong>
              </p>
            </div>
          </Painel>
        )}

        {podeChamados && (
          <Painel titulo="Evolução de chamados" subtitulo="Últimos 6 meses" vazio={evolucaoChamados.every((b) => b.valor === 0)}>
            <BarrasVerticais itens={evolucaoChamados} />
          </Painel>
        )}

        {podeManutencao && (
          <Painel
            titulo="Manutenção por status"
            subtitulo={intervalo ? "No período selecionado" : "Selecione um período"}
            vazio={manutencoesNoPeriodo.length === 0}
          >
            <BarrasHorizontais itens={manutencaoPorStatus} />
          </Painel>
        )}

        {podeFinanceiro && (
          <Painel
            titulo="Receitas x Despesas"
            subtitulo={intervalo ? "No período selecionado" : "Selecione um período"}
            vazio={receitasDespesas.every((i) => i.valor === 0)}
          >
            <BarrasHorizontais itens={receitasDespesas} formatarValor={formatarMoeda} />
          </Painel>
        )}

        {podeFinanceiro && (
          <Painel
            titulo="Contas a pagar por status"
            subtitulo="Situação atual (não depende do período)"
            vazio={contasPagarPorStatus.every((i) => i.valor === 0)}
          >
            <BarrasHorizontais itens={contasPagarPorStatus} />
          </Painel>
        )}
      </div>
    </section>
  );
}
