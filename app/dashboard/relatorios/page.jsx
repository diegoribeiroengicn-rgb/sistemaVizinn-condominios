"use client";

// Sistema de Relatórios: Financeiro, Chamados, Avisos, Portaria e
// Auditoria. Cada tipo busca seus próprios dados reais (uma vez, sem
// filtro de período no banco) e os filtros — incluindo período — são
// aplicados no mesmo array que alimenta a pré-visualização e a
// exportação, garantindo que PDF/Word nunca mostrem algo diferente do
// que a tela já mostrou. Segurança: a mesma consulta autenticada usada
// em todo o resto do app, então a RLS de cada tabela já barra quem não
// tem permissão — o seletor de tipo também só oferece o que o usuário
// pode ver, como reforço de UX.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { PERIODO_OPTIONS, calcularIntervaloPeriodo, dentroDoIntervalo, formatarIntervalo } from "@/lib/periodo";
import { gerarPdf, gerarDocx } from "@/lib/relatorios";
import { STATUS_PAGAR_LABELS, STATUS_RECEBER_LABELS, formatarMoeda } from "@/lib/financeiro";
import { STATUS_LABELS as CHAMADOS_STATUS_LABELS, STATUS_ORDER as CHAMADOS_STATUS_ORDER, PRIORIDADE_LABELS, PRIORIDADE_ORDER, TIPO_LABELS as CHAMADOS_TIPO_LABELS } from "@/lib/chamados";

function formatarData(valor, comHora = false) {
  if (!valor) return "-";
  const d = new Date(valor);
  return comHora ? d.toLocaleString("pt-BR") : d.toLocaleDateString("pt-BR");
}

// Nome de exibição de cada chave de filtro, só pro cabeçalho do PDF/Word
// ("Filtros utilizados") — as chaves internas (camelCase) não aparecem
// pro usuário em nenhum outro lugar.
const FILTRO_LABELS = {
  tipoLancamento: "Tipo",
  categoria: "Categoria",
  status: "Status",
  fornecedor: "Fornecedor",
  prioridade: "Prioridade",
  tipoChamado: "Tipo de chamado",
  unidade: "Unidade",
  soAtrasados: "Somente atrasados",
  pessoa: "Pessoa",
  tipoAcesso: "Tipo de acesso",
  formaEntrada: "Forma de entrada",
  usuario: "Usuário",
  modulo: "Módulo",
  acao: "Ação",
};

const TIPOS_RELATORIO = [
  { id: "financeiro", label: "Financeiro", modulo: "financeiro" },
  { id: "chamados", label: "Chamados", modulo: "chamados" },
  { id: "avisos", label: "Avisos", modulo: "avisos" },
  { id: "portaria", label: "Portaria", modulo: "portaria" },
  { id: "auditoria", label: "Auditoria", modulo: "auditoria" },
];

function PainelFiltro({ children }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

function CampoFiltro({ label, children }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {children}
    </div>
  );
}

function TabelaPreview({ colunas, linhas }) {
  if (linhas.length === 0) {
    return <div className="card text-center text-navy-400">Nenhum registro encontrado para os filtros selecionados.</div>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-navy-100 text-navy-400">
            {colunas.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-2 py-2 font-semibold">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.slice(0, 200).map((linha, i) => (
            <tr key={i} className="border-b border-navy-50 text-navy-700">
              {colunas.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-2 py-1.5">
                  {linha[c.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {linhas.length > 200 && (
        <p className="mt-2 text-xs text-navy-400">
          Mostrando 200 de {linhas.length} registros na tela — a exportação leva todos.
        </p>
      )}
    </div>
  );
}

function Resumo({ itens }) {
  if (!itens || itens.length === 0) return null;
  return (
    <div className="card grid grid-cols-2 gap-3 sm:grid-cols-4">
      {itens.map((item) => (
        <div key={item.label}>
          <p className="text-xs text-navy-400">{item.label}</p>
          <p className="text-lg font-bold text-navy-900">{item.valor}</p>
        </div>
      ))}
    </div>
  );
}

export default function RelatoriosPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  const tiposDisponiveis = TIPOS_RELATORIO.filter((t) => temPermissao(t.modulo, "visualizar"));

  const [tipo, setTipo] = useState(null);

  useEffect(() => {
    if (tipo && tiposDisponiveis.some((t) => t.id === tipo)) return;
    if (tiposDisponiveis.length > 0) setTipo(tiposDisponiveis[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiposDisponiveis.map((t) => t.id).join(",")]);
  const [periodo, setPeriodo] = useState("mes_atual");
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState({ inicio: "", fim: "" });
  const [dadosBrutos, setDadosBrutos] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(null);
  const [filtros, setFiltros] = useState({});

  const intervalo = calcularIntervaloPeriodo(periodo, periodoPersonalizado);
  const tipoAtual = TIPOS_RELATORIO.find((t) => t.id === tipo);

  const carregar = useCallback(async () => {
    if (!condominio?.id || !tipo) return;
    setCarregando(true);
    setError("");
    setFiltros({});

    let resultado = { data: null, error: null };
    if (tipo === "financeiro") {
      const [pagar, receber] = await Promise.all([
        supabase.from("contas_pagar").select("*").eq("condominio_id", condominio.id),
        supabase.from("contas_receber").select("*").eq("condominio_id", condominio.id),
      ]);
      if (pagar.error || receber.error) resultado.error = pagar.error || receber.error;
      else resultado.data = { pagar: pagar.data || [], receber: receber.data || [] };
    } else if (tipo === "chamados") {
      const [chamados, colaboradores] = await Promise.all([
        supabase.from("chamados").select("*").eq("condominio_id", condominio.id),
        supabase.from("colaboradores").select("id, nome").eq("condominio_id", condominio.id),
      ]);
      if (chamados.error) resultado.error = chamados.error;
      else resultado.data = { chamados: chamados.data || [], colaboradores: colaboradores.data || [] };
    } else if (tipo === "avisos") {
      resultado = await supabase.from("avisos").select("*").eq("condominio_id", condominio.id);
    } else if (tipo === "portaria") {
      resultado = await supabase.from("portaria_registros").select("*").eq("condominio_id", condominio.id);
    } else if (tipo === "auditoria") {
      resultado = await supabase
        .from("auditoria")
        .select("*")
        .eq("condominio_id", condominio.id)
        .order("created_at", { ascending: false })
        .limit(2000);
    }

    setCarregando(false);
    if (resultado.error) {
      setError(resultado.error.message);
      setDadosBrutos(null);
      return;
    }
    setDadosBrutos(resultado.data);
  }, [condominio?.id, tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ---- FINANCEIRO ----------------------------------------------------
  const financeiro = useMemo(() => {
    if (tipo !== "financeiro" || !dadosBrutos) return null;
    const lancamentos = [
      ...dadosBrutos.pagar.map((c) => ({ ...c, tipoLancamento: "despesa" })),
      ...dadosBrutos.receber.map((c) => ({ ...c, tipoLancamento: "receita" })),
    ];
    const filtrados = lancamentos.filter((l) => {
      if (!dentroDoIntervalo(l.data_vencimento || l.data_competencia, intervalo)) return false;
      if (filtros.tipoLancamento && l.tipoLancamento !== filtros.tipoLancamento) return false;
      if (filtros.categoria && l.categoria !== filtros.categoria) return false;
      if (filtros.status && l.status !== filtros.status) return false;
      if (filtros.fornecedor && l.fornecedor_nome !== filtros.fornecedor) return false;
      return true;
    });
    const colunas = [
      { key: "tipo", header: "Tipo" },
      { key: "descricao", header: "Descrição" },
      { key: "categoria", header: "Categoria" },
      { key: "fornecedor", header: "Fornecedor/Responsável" },
      { key: "competencia", header: "Competência" },
      { key: "vencimento", header: "Vencimento" },
      { key: "pagoRecebido", header: "Pago/Recebido em" },
      { key: "valor", header: "Valor" },
      { key: "status", header: "Status" },
    ];
    const linhas = filtrados.map((l) => ({
      tipo: l.tipoLancamento === "receita" ? "Receita" : "Despesa",
      descricao: l.descricao,
      categoria: l.categoria || "-",
      fornecedor: l.fornecedor_nome || l.responsavel_financeiro || "-",
      competencia: formatarData(l.data_competencia),
      vencimento: formatarData(l.data_vencimento),
      pagoRecebido: formatarData(l.data_pagamento || l.data_recebimento),
      valor: formatarMoeda(l.valor_recebido ?? l.valor),
      status: l.tipoLancamento === "receita" ? STATUS_RECEBER_LABELS[l.status] : STATUS_PAGAR_LABELS[l.status],
    }));
    const totalReceitas = filtrados.filter((l) => l.tipoLancamento === "receita" && l.status === "recebida").reduce((s, l) => s + Number(l.valor_recebido ?? l.valor ?? 0), 0);
    const totalDespesas = filtrados.filter((l) => l.tipoLancamento === "despesa" && l.status === "pago").reduce((s, l) => s + Number(l.valor || 0), 0);
    const aReceber = filtrados.filter((l) => l.tipoLancamento === "receita" && !["recebida", "cancelada"].includes(l.status)).reduce((s, l) => s + Number(l.valor || 0), 0);
    const aPagar = filtrados.filter((l) => l.tipoLancamento === "despesa" && !["pago", "cancelada"].includes(l.status)).reduce((s, l) => s + Number(l.valor || 0), 0);
    const vencidas = filtrados.filter((l) => l.status === "vencida").length;
    const categoriasDisponiveis = [...new Set(lancamentos.map((l) => l.categoria).filter(Boolean))].sort();
    const fornecedoresDisponiveis = [...new Set(lancamentos.map((l) => l.fornecedor_nome).filter(Boolean))].sort();
    return {
      colunas,
      linhas,
      categoriasDisponiveis,
      fornecedoresDisponiveis,
      resumo: [
        { label: "Total de receitas", valor: formatarMoeda(totalReceitas) },
        { label: "Total de despesas", valor: formatarMoeda(totalDespesas) },
        { label: "Saldo do período", valor: formatarMoeda(totalReceitas - totalDespesas) },
        { label: "A receber (em aberto)", valor: formatarMoeda(aReceber) },
        { label: "A pagar (em aberto)", valor: formatarMoeda(aPagar) },
        { label: "Contas vencidas", valor: vencidas },
      ],
    };
  }, [tipo, dadosBrutos, intervalo, filtros]);

  // ---- CHAMADOS --------------------------------------------------------
  const chamadosRel = useMemo(() => {
    if (tipo !== "chamados" || !dadosBrutos) return null;
    const colaboradorPorId = {};
    for (const c of dadosBrutos.colaboradores) colaboradorPorId[c.id] = c.nome;

    const filtrados = dadosBrutos.chamados.filter((c) => {
      if (!dentroDoIntervalo(c.created_at, intervalo)) return false;
      if (filtros.status && c.status !== filtros.status) return false;
      if (filtros.prioridade && c.prioridade !== filtros.prioridade) return false;
      if (filtros.tipoChamado && c.tipo !== filtros.tipoChamado) return false;
      if (filtros.categoria && !(c.categoria || "").toLowerCase().includes(filtros.categoria.toLowerCase())) return false;
      if (filtros.unidade && !(c.unidade || "").toLowerCase().includes(filtros.unidade.toLowerCase())) return false;
      if (filtros.soAtrasados && !(c.data_prevista && new Date(c.data_prevista) < new Date() && !["concluido", "cancelado"].includes(c.status))) return false;
      return true;
    });

    const colunas = [
      { key: "id", header: "ID" },
      { key: "titulo", header: "Título" },
      { key: "tipo", header: "Tipo" },
      { key: "categoria", header: "Categoria" },
      { key: "solicitante", header: "Solicitante" },
      { key: "unidade", header: "Unidade" },
      { key: "responsavel", header: "Responsável" },
      { key: "executor", header: "Executor" },
      { key: "prioridade", header: "Prioridade" },
      { key: "status", header: "Status" },
      { key: "abertura", header: "Abertura" },
      { key: "prazo", header: "Prazo previsto" },
      { key: "conclusao", header: "Conclusão" },
      { key: "resultado", header: "Resultado" },
    ];
    const linhas = filtrados.map((c) => ({
      id: c.id.slice(0, 8),
      titulo: c.titulo,
      tipo: CHAMADOS_TIPO_LABELS[c.tipo] || c.tipo,
      categoria: c.categoria || "-",
      solicitante: c.solicitante_nome || "-",
      unidade: [c.bloco, c.unidade].filter(Boolean).join(" / ") || c.local || "-",
      responsavel: colaboradorPorId[c.responsavel_colaborador_id] || c.responsavel_nome || "-",
      executor: c.executor_nome || "-",
      prioridade: PRIORIDADE_LABELS[c.prioridade] || c.prioridade,
      status: CHAMADOS_STATUS_LABELS[c.status] || c.status,
      abertura: formatarData(c.created_at),
      prazo: formatarData(c.data_prevista),
      conclusao: formatarData(c.data_conclusao, true),
      resultado: c.resultado || "-",
    }));

    const porStatus = {};
    for (const c of filtrados) porStatus[c.status] = (porStatus[c.status] || 0) + 1;
    const atrasados = filtrados.filter((c) => c.data_prevista && new Date(c.data_prevista) < new Date() && !["concluido", "cancelado"].includes(c.status)).length;
    const concluidosComData = filtrados.filter((c) => c.status === "concluido" && c.data_conclusao);
    const tempoMedio = concluidosComData.length
      ? (concluidosComData.reduce((s, c) => s + (new Date(c.data_conclusao) - new Date(c.created_at)) / 86400000, 0) / concluidosComData.length).toFixed(1)
      : null;
    const total = filtrados.length;
    const taxaConclusao = total ? Math.round((porStatus.concluido || 0) / total * 100) : null;
    const respondidos = filtrados.filter((c) => c.status !== "aberto").length;
    const taxaResposta = total ? Math.round((respondidos / total) * 100) : null;

    return {
      colunas,
      linhas,
      resumo: [
        { label: "Total de chamados", valor: total },
        ...CHAMADOS_STATUS_ORDER.filter((s) => porStatus[s]).map((s) => ({ label: CHAMADOS_STATUS_LABELS[s], valor: porStatus[s] })),
        { label: "Atrasados", valor: atrasados },
        { label: "Tempo médio de atendimento", valor: tempoMedio ? `${tempoMedio} dias` : "-" },
        { label: "Taxa de conclusão", valor: taxaConclusao != null ? `${taxaConclusao}%` : "-" },
        { label: "Taxa de resposta", valor: taxaResposta != null ? `${taxaResposta}%` : "-" },
      ],
    };
  }, [tipo, dadosBrutos, intervalo, filtros]);

  // ---- AVISOS ------------------------------------------------------
  const avisosRel = useMemo(() => {
    if (tipo !== "avisos" || !dadosBrutos) return null;
    const filtrados = dadosBrutos.filter((a) => dentroDoIntervalo(a.created_at, intervalo));
    const colunas = [
      { key: "titulo", header: "Título" },
      { key: "mensagem", header: "Conteúdo" },
      { key: "publicacao", header: "Data de publicação" },
    ];
    const linhas = filtrados.map((a) => ({
      titulo: a.titulo,
      mensagem: a.mensagem,
      publicacao: formatarData(a.created_at, true),
    }));
    return {
      colunas,
      linhas,
      resumo: [{ label: "Total de avisos publicados", valor: filtrados.length }],
    };
  }, [tipo, dadosBrutos, intervalo]);

  // ---- PORTARIA ------------------------------------------------------
  const portariaRel = useMemo(() => {
    if (tipo !== "portaria" || !dadosBrutos) return null;
    const filtrados = dadosBrutos.filter((r) => {
      if (!dentroDoIntervalo(r.entrada_em, intervalo)) return false;
      if (filtros.pessoa && !r.nome_pessoa.toLowerCase().includes(filtros.pessoa.toLowerCase())) return false;
      if (filtros.unidade && !(r.unidade || "").toLowerCase().includes(filtros.unidade.toLowerCase())) return false;
      if (filtros.tipoAcesso && r.tipo_acesso !== filtros.tipoAcesso) return false;
      if (filtros.formaEntrada && r.forma_entrada !== filtros.formaEntrada) return false;
      if (filtros.status === "dentro" && r.saida_em) return false;
      if (filtros.status === "fora" && !r.saida_em) return false;
      return true;
    });
    const colunas = [
      { key: "nome", header: "Nome" },
      { key: "unidade", header: "Unidade" },
      { key: "tipo", header: "Tipo de acesso" },
      { key: "forma", header: "Entrada" },
      { key: "placa", header: "Placa" },
      { key: "entrada", header: "Entrada" },
      { key: "saida", header: "Saída" },
      { key: "entradaPor", header: "Registrado por (entrada)" },
      { key: "saidaPor", header: "Registrado por (saída)" },
    ];
    const linhas = filtrados.map((r) => ({
      nome: r.nome_pessoa,
      unidade: r.unidade || "-",
      tipo: r.tipo_acesso,
      forma: r.forma_entrada === "a_pe" ? "A pé" : "Carro",
      placa: r.placa_veiculo || "-",
      entrada: formatarData(r.entrada_em, true),
      saida: formatarData(r.saida_em, true),
      entradaPor: r.entrada_por || "-",
      saidaPor: r.saida_por || "-",
    }));
    const porTipo = {};
    for (const r of filtrados) porTipo[r.tipo_acesso] = (porTipo[r.tipo_acesso] || 0) + 1;
    const dentro = filtrados.filter((r) => !r.saida_em).length;
    return {
      colunas,
      linhas,
      resumo: [
        { label: "Total de entradas", valor: filtrados.length },
        { label: "Com saída registrada", valor: filtrados.length - dentro },
        { label: "Atualmente dentro", valor: dentro },
        ...Object.entries(porTipo).map(([t, qtd]) => ({ label: `Tipo: ${t}`, valor: qtd })),
      ],
    };
  }, [tipo, dadosBrutos, intervalo, filtros]);

  // ---- AUDITORIA -----------------------------------------------------
  const auditoriaRel = useMemo(() => {
    if (tipo !== "auditoria" || !dadosBrutos) return null;
    const filtrados = dadosBrutos.filter((ev) => {
      if (!dentroDoIntervalo(ev.created_at, intervalo)) return false;
      if (filtros.usuario && !(ev.usuario_nome || "").toLowerCase().includes(filtros.usuario.toLowerCase())) return false;
      if (filtros.modulo && ev.modulo !== filtros.modulo) return false;
      if (filtros.acao && ev.acao !== filtros.acao) return false;
      return true;
    });
    const colunas = [
      { key: "usuario", header: "Usuário" },
      { key: "papel", header: "Perfil" },
      { key: "quando", header: "Data/hora" },
      { key: "modulo", header: "Módulo" },
      { key: "acao", header: "Ação" },
      { key: "registro", header: "Registro" },
    ];
    const linhas = filtrados.map((ev) => ({
      usuario: ev.usuario_nome || "-",
      papel: ev.papel || "-",
      quando: formatarData(ev.created_at, true),
      modulo: ev.modulo,
      acao: ev.acao,
      registro: ev.registro_id ? ev.registro_id.slice(0, 8) : "-",
    }));
    const modulosDisponiveis = [...new Set(dadosBrutos.map((e) => e.modulo))].sort();
    const acoesDisponiveis = [...new Set(dadosBrutos.map((e) => e.acao))].sort();
    return { colunas, linhas, modulosDisponiveis, acoesDisponiveis, resumo: [{ label: "Total de eventos", valor: filtrados.length }] };
  }, [tipo, dadosBrutos, intervalo, filtros]);

  const relatorioAtual = { financeiro, chamados: chamadosRel, avisos: avisosRel, portaria: portariaRel, auditoria: auditoriaRel }[tipo];

  function montarConfigExport() {
    return {
      condominioNome: condominio?.nome,
      tipoLabel: tipoAtual?.label || "",
      periodoLabel: intervalo ? formatarIntervalo(intervalo) : "Todos os registros",
      filtros: Object.entries(filtros)
        .filter(([, v]) => v)
        .map(([k, v]) => ({ label: FILTRO_LABELS[k] || k, valor: String(v) })),
      colunas: relatorioAtual.colunas,
      linhas: relatorioAtual.linhas,
      resumo: relatorioAtual.resumo,
      geradoEm: new Date(),
      geradoPor: nomeUsuario,
    };
  }

  async function handleExportarPdf() {
    if (!relatorioAtual) return;
    setExportando("pdf");
    try {
      await gerarPdf(montarConfigExport());
    } finally {
      setExportando(null);
    }
  }

  async function handleExportarDocx() {
    if (!relatorioAtual) return;
    setExportando("docx");
    try {
      await gerarDocx(montarConfigExport());
    } finally {
      setExportando(null);
    }
  }

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  if (tiposDisponiveis.length === 0) {
    return (
      <div className="card text-center text-navy-400">
        Você não tem acesso a nenhum módulo com relatório disponível.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Relatórios</h1>
        <p className="mt-1 text-sm text-navy-500">
          Visualize, filtre e exporte para PDF ou Word — sempre com dados reais do seu condomínio.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {tiposDisponiveis.map((t) => (
          <button
            key={t.id}
            onClick={() => setTipo(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tipo === t.id ? "bg-midnight text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card space-y-3">
        <PainelFiltro>
          <CampoFiltro label="Período">
            <select className="input-field w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              {PERIODO_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </CampoFiltro>
          {periodo === "personalizado" && (
            <>
              <CampoFiltro label="De">
                <input
                  type="date"
                  className="input-field w-auto"
                  value={periodoPersonalizado.inicio}
                  onChange={(e) => setPeriodoPersonalizado((p) => ({ ...p, inicio: e.target.value }))}
                />
              </CampoFiltro>
              <CampoFiltro label="Até">
                <input
                  type="date"
                  className="input-field w-auto"
                  value={periodoPersonalizado.fim}
                  onChange={(e) => setPeriodoPersonalizado((p) => ({ ...p, fim: e.target.value }))}
                />
              </CampoFiltro>
            </>
          )}

          {tipo === "financeiro" && financeiro && (
            <>
              <CampoFiltro label="Tipo">
                <select className="input-field w-auto" value={filtros.tipoLancamento || ""} onChange={(e) => setFiltros((f) => ({ ...f, tipoLancamento: e.target.value }))}>
                  <option value="">Receitas e despesas</option>
                  <option value="receita">Só receitas</option>
                  <option value="despesa">Só despesas</option>
                </select>
              </CampoFiltro>
              <CampoFiltro label="Categoria">
                <select className="input-field w-auto" value={filtros.categoria || ""} onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}>
                  <option value="">Todas</option>
                  {financeiro.categoriasDisponiveis.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </CampoFiltro>
              {financeiro.fornecedoresDisponiveis.length > 0 && (
                <CampoFiltro label="Fornecedor">
                  <select className="input-field w-auto" value={filtros.fornecedor || ""} onChange={(e) => setFiltros((f) => ({ ...f, fornecedor: e.target.value }))}>
                    <option value="">Todos</option>
                    {financeiro.fornecedoresDisponiveis.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </CampoFiltro>
              )}
            </>
          )}

          {tipo === "chamados" && (
            <>
              <CampoFiltro label="Status">
                <select className="input-field w-auto" value={filtros.status || ""} onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">Todos</option>
                  {CHAMADOS_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {CHAMADOS_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </CampoFiltro>
              <CampoFiltro label="Prioridade">
                <select className="input-field w-auto" value={filtros.prioridade || ""} onChange={(e) => setFiltros((f) => ({ ...f, prioridade: e.target.value }))}>
                  <option value="">Todas</option>
                  {PRIORIDADE_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PRIORIDADE_LABELS[p]}
                    </option>
                  ))}
                </select>
              </CampoFiltro>
              <CampoFiltro label="Tipo">
                <select className="input-field w-auto" value={filtros.tipoChamado || ""} onChange={(e) => setFiltros((f) => ({ ...f, tipoChamado: e.target.value }))}>
                  <option value="">Condomínio e interno</option>
                  <option value="condominio">Condomínio</option>
                  <option value="interno">Interno</option>
                </select>
              </CampoFiltro>
              <CampoFiltro label="Categoria contém">
                <input className="input-field w-auto" value={filtros.categoria || ""} onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))} />
              </CampoFiltro>
              <CampoFiltro label="Unidade contém">
                <input className="input-field w-auto" value={filtros.unidade || ""} onChange={(e) => setFiltros((f) => ({ ...f, unidade: e.target.value }))} />
              </CampoFiltro>
              <label className="flex items-center gap-1.5 pb-2 text-sm text-navy-600">
                <input type="checkbox" checked={Boolean(filtros.soAtrasados)} onChange={(e) => setFiltros((f) => ({ ...f, soAtrasados: e.target.checked }))} />
                Só atrasados
              </label>
            </>
          )}

          {tipo === "portaria" && (
            <>
              <CampoFiltro label="Pessoa contém">
                <input className="input-field w-auto" value={filtros.pessoa || ""} onChange={(e) => setFiltros((f) => ({ ...f, pessoa: e.target.value }))} />
              </CampoFiltro>
              <CampoFiltro label="Unidade contém">
                <input className="input-field w-auto" value={filtros.unidade || ""} onChange={(e) => setFiltros((f) => ({ ...f, unidade: e.target.value }))} />
              </CampoFiltro>
              <CampoFiltro label="Tipo de acesso">
                <select className="input-field w-auto" value={filtros.tipoAcesso || ""} onChange={(e) => setFiltros((f) => ({ ...f, tipoAcesso: e.target.value }))}>
                  <option value="">Todos</option>
                  <option value="visitante">Visitante</option>
                  <option value="entregador">Entregador</option>
                  <option value="prestador_servico">Prestador de serviço</option>
                  <option value="morador">Morador</option>
                  <option value="outro">Outro</option>
                </select>
              </CampoFiltro>
              <CampoFiltro label="Entrada">
                <select className="input-field w-auto" value={filtros.formaEntrada || ""} onChange={(e) => setFiltros((f) => ({ ...f, formaEntrada: e.target.value }))}>
                  <option value="">A pé e carro</option>
                  <option value="a_pe">A pé</option>
                  <option value="carro">Carro</option>
                </select>
              </CampoFiltro>
              <CampoFiltro label="Situação">
                <select className="input-field w-auto" value={filtros.status || ""} onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">Dentro e fora</option>
                  <option value="dentro">Ainda dentro</option>
                  <option value="fora">Já saiu</option>
                </select>
              </CampoFiltro>
            </>
          )}

          {tipo === "auditoria" && auditoriaRel && (
            <>
              <CampoFiltro label="Usuário contém">
                <input className="input-field w-auto" value={filtros.usuario || ""} onChange={(e) => setFiltros((f) => ({ ...f, usuario: e.target.value }))} />
              </CampoFiltro>
              <CampoFiltro label="Módulo">
                <select className="input-field w-auto" value={filtros.modulo || ""} onChange={(e) => setFiltros((f) => ({ ...f, modulo: e.target.value }))}>
                  <option value="">Todos</option>
                  {auditoriaRel.modulosDisponiveis.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </CampoFiltro>
              <CampoFiltro label="Ação">
                <select className="input-field w-auto" value={filtros.acao || ""} onChange={(e) => setFiltros((f) => ({ ...f, acao: e.target.value }))}>
                  <option value="">Todas</option>
                  {auditoriaRel.acoesDisponiveis.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </CampoFiltro>
            </>
          )}
        </PainelFiltro>

        {intervalo && <p className="text-xs text-navy-400">Período: {formatarIntervalo(intervalo)}</p>}
        {tipo === "avisos" && (
          <p className="text-xs text-navy-400">
            O sistema hoje só registra título, conteúdo e data de publicação dos avisos — sem autor,
            categoria ou leitura por morador.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {carregando || !relatorioAtual ? (
        <p className="text-navy-500">Carregando dados...</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleExportarPdf} disabled={Boolean(exportando)} className="btn-secondary disabled:opacity-50">
              {exportando === "pdf" ? "Gerando PDF..." : "Exportar PDF"}
            </button>
            <button onClick={handleExportarDocx} disabled={Boolean(exportando)} className="btn-secondary disabled:opacity-50">
              {exportando === "docx" ? "Gerando Word..." : "Exportar Word"}
            </button>
          </div>

          <Resumo itens={relatorioAtual.resumo} />
          <TabelaPreview colunas={relatorioAtual.colunas} linhas={relatorioAtual.linhas} />
        </>
      )}
    </div>
  );
}
