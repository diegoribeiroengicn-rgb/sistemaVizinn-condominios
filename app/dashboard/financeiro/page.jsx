"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_RECEITA,
  FORMAS_PAGAMENTO,
  STATUS_PAGAR_FINAIS,
  STATUS_PAGAR_LABELS,
  STATUS_PAGAR_ORDER,
  STATUS_PAGAR_STYLES,
  STATUS_RECEBER_FINAIS,
  STATUS_RECEBER_LABELS,
  STATUS_RECEBER_ORDER,
  STATUS_RECEBER_STYLES,
  VENCIMENTO_BADGE_STYLES,
  calcularStatusVencimento,
  formatarMoeda,
} from "@/lib/financeiro";

const ABAS = [
  { id: "visao", label: "Visão financeira" },
  { id: "pagar", label: "Contas a pagar" },
  { id: "receber", label: "Contas a receber" },
  { id: "boletos", label: "Boletos" },
];

const emptyContaPagar = {
  descricao: "",
  categoria: "",
  fornecedorId: "",
  documentoNumero: "",
  dataCompetencia: "",
  dataVencimento: "",
  dataPagamento: "",
  valor: "",
  formaPagamento: "",
  status: "pendente",
  observacoes: "",
  parcela: "",
  qtdParcelas: "",
  manutencaoId: "",
  chamadoId: "",
};

const emptyContaReceber = {
  descricao: "",
  unidade: "",
  responsavelFinanceiro: "",
  categoria: "",
  dataCompetencia: "",
  dataVencimento: "",
  dataRecebimento: "",
  valor: "",
  valorRecebido: "",
  desconto: "",
  jurosMulta: "",
  formaPagamento: "",
  status: "pendente",
  observacoes: "",
  boletoReferencia: "",
};

function inicioPeriodo(periodo, dataBase) {
  const d = new Date(dataBase);
  if (periodo === "mes") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (periodo === "trimestre") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  if (periodo === "semestre") return new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1);
  if (periodo === "ano") return new Date(d.getFullYear(), 0, 1);
  return null;
}

function fimPeriodo(periodo, dataBase) {
  const d = new Date(dataBase);
  if (periodo === "mes") return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  if (periodo === "trimestre") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0);
  if (periodo === "semestre") return new Date(d.getFullYear(), d.getMonth() < 6 ? 5 : 11, 31);
  if (periodo === "ano") return new Date(d.getFullYear(), 11, 31);
  return null;
}

function dentroDoPeriodo(dataStr, inicio, fim) {
  if (!dataStr) return false;
  const data = new Date(`${dataStr}T00:00:00`);
  return data >= inicio && data <= fim;
}

function agruparPorCategoria(itens, campoValor) {
  const mapa = {};
  for (const item of itens) {
    const cat = item.categoria || "Sem categoria";
    mapa[cat] = (mapa[cat] || 0) + Number(item[campoValor] || 0);
  }
  return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
}

export default function FinanceiroPage() {
  const { condominio, temPermissao } = useAuth();
  const searchParams = useSearchParams();
  const [aba, setAba] = useState("visao");
  const [contasPagar, setContasPagar] = useState([]);
  const [contasReceber, setContasReceber] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [arquivoPagar, setArquivoPagar] = useState(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [abrindoDocumentoId, setAbrindoDocumentoId] = useState(null);
  const [periodo, setPeriodo] = useState("mes");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const [formPagar, setFormPagar] = useState(emptyContaPagar);
  useAvisoSaidaSemSalvar(formPagar, emptyContaPagar);
  const [submittingPagar, setSubmittingPagar] = useState(false);
  const [formReceber, setFormReceber] = useState(emptyContaReceber);
  useAvisoSaidaSemSalvar(formReceber, emptyContaReceber);
  const [submittingReceber, setSubmittingReceber] = useState(false);
  const [filtroStatusPagar, setFiltroStatusPagar] = useState("");
  const [filtroStatusReceber, setFiltroStatusReceber] = useState("");

  const podeCriar = temPermissao("financeiro", "criar");
  const podeEditar = temPermissao("financeiro", "editar");

  useEffect(() => {
    const abaParam = searchParams.get("aba");
    if (abaParam && ABAS.some((a) => a.id === abaParam)) setAba(abaParam);
    const propostaId = searchParams.get("propostaId");
    if (propostaId) {
      setFormPagar((f) => ({
        ...f,
        descricao: searchParams.get("descricao") || f.descricao,
        valor: searchParams.get("valor") || f.valor,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const [pagarResult, receberResult, fornecedoresResult, manutencoesResult, chamadosResult] = await Promise.all([
      supabase.from("contas_pagar").select("*").eq("condominio_id", condominio.id).order("data_vencimento", { ascending: true }),
      supabase.from("contas_receber").select("*").eq("condominio_id", condominio.id).order("data_vencimento", { ascending: true }),
      temPermissao("fornecedores", "visualizar")
        ? supabase.from("fornecedores").select("id, razao_social").eq("condominio_id", condominio.id)
        : Promise.resolve({ data: [], error: null }),
      temPermissao("manutencao", "visualizar")
        ? supabase.from("manutencoes").select("id, titulo").eq("condominio_id", condominio.id)
        : Promise.resolve({ data: [], error: null }),
      temPermissao("chamados", "visualizar")
        ? supabase.from("chamados").select("id, titulo").eq("condominio_id", condominio.id)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (pagarResult.error) setError(pagarResult.error.message);
    else setContasPagar(pagarResult.data || []);
    if (!receberResult.error) setContasReceber(receberResult.data || []);
    if (!fornecedoresResult.error) setFornecedores(fornecedoresResult.data || []);
    if (!manutencoesResult.error) setManutencoes(manutencoesResult.data || []);
    if (!chamadosResult.error) setChamados(chamadosResult.data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreatePagar(e) {
    e.preventDefault();
    if (!condominio?.id || !formPagar.descricao.trim() || !formPagar.valor) return;
    setSubmittingPagar(true);
    setError("");

    let documentoUrl = null;
    if (arquivoPagar) {
      setEnviandoArquivo(true);
      const caminho = `${condominio.id}/${Date.now()}-${arquivoPagar.name}`;
      const { error: uploadError } = await supabase.storage
        .from("financeiro-documentos")
        .upload(caminho, arquivoPagar);
      setEnviandoArquivo(false);
      if (uploadError) {
        setError(`Erro ao enviar documento: ${uploadError.message}`);
        setSubmittingPagar(false);
        return;
      }
      documentoUrl = caminho;
    }

    const fornecedor = fornecedores.find((f) => f.id === formPagar.fornecedorId);
    const { error: insertError } = await supabase.from("contas_pagar").insert({
      condominio_id: condominio.id,
      descricao: formPagar.descricao.trim(),
      categoria: formPagar.categoria.trim() || null,
      fornecedor_id: formPagar.fornecedorId || null,
      fornecedor_nome: fornecedor?.razao_social || null,
      documento_numero: formPagar.documentoNumero.trim() || null,
      documento_url: documentoUrl,
      data_competencia: formPagar.dataCompetencia || null,
      data_vencimento: formPagar.dataVencimento || null,
      data_pagamento: formPagar.dataPagamento || null,
      valor: Number(formPagar.valor),
      forma_pagamento: formPagar.formaPagamento.trim() || null,
      status: formPagar.status,
      observacoes: formPagar.observacoes.trim() || null,
      parcela: formPagar.parcela ? Number(formPagar.parcela) : null,
      qtd_parcelas: formPagar.qtdParcelas ? Number(formPagar.qtdParcelas) : null,
      manutencao_origem_id: formPagar.manutencaoId || null,
      chamado_origem_id: formPagar.chamadoId || null,
      proposta_origem_id: searchParams.get("propostaId") || null,
    });
    setSubmittingPagar(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setFormPagar(emptyContaPagar);
    setArquivoPagar(null);
    load();
  }

  async function handleVerDocumento(conta) {
    if (!conta.documento_url) return;
    setAbrindoDocumentoId(conta.id);
    setError("");
    const { data, error: urlError } = await supabase.storage
      .from("financeiro-documentos")
      .createSignedUrl(conta.documento_url, 60);
    setAbrindoDocumentoId(null);
    if (urlError) {
      setError(`Erro ao abrir documento: ${urlError.message}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCreateReceber(e) {
    e.preventDefault();
    if (!condominio?.id || !formReceber.descricao.trim() || !formReceber.valor) return;
    setSubmittingReceber(true);
    setError("");
    const { error: insertError } = await supabase.from("contas_receber").insert({
      condominio_id: condominio.id,
      descricao: formReceber.descricao.trim(),
      unidade: formReceber.unidade.trim() || null,
      responsavel_financeiro: formReceber.responsavelFinanceiro.trim() || null,
      categoria: formReceber.categoria.trim() || null,
      data_competencia: formReceber.dataCompetencia || null,
      data_vencimento: formReceber.dataVencimento || null,
      data_recebimento: formReceber.dataRecebimento || null,
      valor: Number(formReceber.valor),
      valor_recebido: formReceber.valorRecebido ? Number(formReceber.valorRecebido) : null,
      desconto: formReceber.desconto ? Number(formReceber.desconto) : null,
      juros_multa: formReceber.jurosMulta ? Number(formReceber.jurosMulta) : null,
      forma_pagamento: formReceber.formaPagamento.trim() || null,
      status: formReceber.status,
      observacoes: formReceber.observacoes.trim() || null,
      boleto_referencia: formReceber.boletoReferencia.trim() || null,
    });
    setSubmittingReceber(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setFormReceber(emptyContaReceber);
    load();
  }

  async function handleStatusPagar(conta, status) {
    const updates = { status };
    if (status === "pago" && !conta.data_pagamento) updates.data_pagamento = new Date().toISOString().slice(0, 10);
    const { error: updateError } = await supabase.from("contas_pagar").update(updates).eq("id", conta.id);
    if (updateError) setError(updateError.message);
    else load();
  }

  async function handleStatusReceber(conta, status) {
    const updates = { status };
    if (status === "recebida" && !conta.data_recebimento) updates.data_recebimento = new Date().toISOString().slice(0, 10);
    const { error: updateError } = await supabase.from("contas_receber").update(updates).eq("id", conta.id);
    if (updateError) setError(updateError.message);
    else load();
  }

  const { inicio, fim } = useMemo(() => {
    if (periodo === "personalizado") {
      return {
        inicio: periodoInicio ? new Date(`${periodoInicio}T00:00:00`) : null,
        fim: periodoFim ? new Date(`${periodoFim}T23:59:59`) : null,
      };
    }
    const hoje = new Date();
    return { inicio: inicioPeriodo(periodo, hoje), fim: fimPeriodo(periodo, hoje) };
  }, [periodo, periodoInicio, periodoFim]);

  const balanco = useMemo(() => {
    if (!inicio || !fim) return null;
    const receberNoPeriodo = contasReceber.filter((c) =>
      dentroDoPeriodo(c.data_competencia || c.data_vencimento, inicio, fim)
    );
    const pagarNoPeriodo = contasPagar.filter((c) =>
      dentroDoPeriodo(c.data_competencia || c.data_vencimento, inicio, fim)
    );
    const totalRecebido = receberNoPeriodo
      .filter((c) => c.status === "recebida")
      .reduce((s, c) => s + Number(c.valor_recebido ?? c.valor ?? 0), 0);
    const totalPago = pagarNoPeriodo.filter((c) => c.status === "pago").reduce((s, c) => s + Number(c.valor || 0), 0);
    const aReceber = receberNoPeriodo.filter((c) => !STATUS_RECEBER_FINAIS.includes(c.status));
    const aPagar = pagarNoPeriodo.filter((c) => !STATUS_PAGAR_FINAIS.includes(c.status));
    const vencidasReceber = contasReceber.filter((c) => calcularStatusVencimento(c.data_vencimento, c.status, STATUS_RECEBER_FINAIS)?.nivel === "vermelho");
    const vencidasPagar = contasPagar.filter((c) => calcularStatusVencimento(c.data_vencimento, c.status, STATUS_PAGAR_FINAIS)?.nivel === "vermelho");

    return {
      totalRecebido,
      totalPago,
      saldo: totalRecebido - totalPago,
      aReceberValor: aReceber.reduce((s, c) => s + Number(c.valor || 0), 0),
      aPagarValor: aPagar.reduce((s, c) => s + Number(c.valor || 0), 0),
      vencidasReceberQtd: vencidasReceber.length,
      vencidasPagarQtd: vencidasPagar.length,
      receitasPorCategoria: agruparPorCategoria(receberNoPeriodo.filter((c) => c.status === "recebida"), "valor"),
      despesasPorCategoria: agruparPorCategoria(pagarNoPeriodo.filter((c) => c.status === "pago"), "valor"),
    };
  }, [contasPagar, contasReceber, inicio, fim]);

  const contasPagarFiltradas = useMemo(
    () => (filtroStatusPagar ? contasPagar.filter((c) => c.status === filtroStatusPagar) : contasPagar),
    [contasPagar, filtroStatusPagar]
  );
  const contasReceberFiltradas = useMemo(
    () => (filtroStatusReceber ? contasReceber.filter((c) => c.status === filtroStatusReceber) : contasReceber),
    [contasReceber, filtroStatusReceber]
  );

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="financeiro">
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Financeiro</h1>
        <p className="mt-1 text-sm text-navy-500">
          Contas a pagar, contas a receber, boletos e o balanço do condomínio.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              aba === a.id ? "bg-midnight text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"
            }`}
          >
            {a.label}
          </button>
        ))}
      </nav>

      {error && <p className="text-sm text-coral-700">{error}</p>}
      {loading && <p className="text-navy-500">Carregando dados financeiros...</p>}

      {!loading && aba === "visao" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center gap-2">
              <select className="input-field w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                <option value="mes">Este mês</option>
                <option value="trimestre">Este trimestre</option>
                <option value="semestre">Este semestre</option>
                <option value="ano">Este ano</option>
                <option value="personalizado">Período personalizado</option>
              </select>
              {periodo === "personalizado" && (
                <>
                  <input type="date" className="input-field w-auto" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
                  <span className="text-navy-400">até</span>
                  <input type="date" className="input-field w-auto" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
                </>
              )}
            </div>

            {balanco && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-navy-500">Total recebido</p>
                    <p className="text-xl font-bold text-emerald-700">{formatarMoeda(balanco.totalRecebido)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500">Total pago</p>
                    <p className="text-xl font-bold text-coral-700">{formatarMoeda(balanco.totalPago)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500">Saldo do período</p>
                    <p className={`text-xl font-bold ${balanco.saldo >= 0 ? "text-navy-900" : "text-coral-700"}`}>
                      {formatarMoeda(balanco.saldo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500">A receber (em aberto)</p>
                    <p className="font-semibold text-navy-800">{formatarMoeda(balanco.aReceberValor)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500">A pagar (em aberto)</p>
                    <p className="font-semibold text-navy-800">{formatarMoeda(balanco.aPagarValor)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500">Contas vencidas</p>
                    <p className="font-semibold text-coral-700">
                      {balanco.vencidasPagarQtd + balanco.vencidasReceberQtd} ({balanco.vencidasPagarQtd} a pagar, {balanco.vencidasReceberQtd} a receber)
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-navy-800">Receitas por categoria</p>
                    {balanco.receitasPorCategoria.length === 0 ? (
                      <p className="mt-1 text-xs text-navy-400">Nenhuma receita recebida no período.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm text-navy-600">
                        {balanco.receitasPorCategoria.map(([cat, valor]) => (
                          <li key={cat} className="flex justify-between">
                            <span>{cat}</span>
                            <span className="font-medium">{formatarMoeda(valor)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy-800">Despesas por categoria</p>
                    {balanco.despesasPorCategoria.length === 0 ? (
                      <p className="mt-1 text-xs text-navy-400">Nenhuma despesa paga no período.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm text-navy-600">
                        {balanco.despesasPorCategoria.map(([cat, valor]) => (
                          <li key={cat} className="flex justify-between">
                            <span>{cat}</span>
                            <span className="font-medium">{formatarMoeda(valor)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!loading && aba === "pagar" && (
        <div className="space-y-4">
          {podeCriar && (
            <div className="card">
              <h2 className="font-display text-lg font-bold text-navy-900">Nova conta a pagar</h2>
              <form onSubmit={handleCreatePagar} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label-field">Descrição</label>
                  <input
                    className="input-field"
                    value={formPagar.descricao}
                    onChange={(e) => setFormPagar((f) => ({ ...f, descricao: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Categoria (opcional)</label>
                  <input
                    className="input-field"
                    list="categorias-despesa"
                    value={formPagar.categoria}
                    onChange={(e) => setFormPagar((f) => ({ ...f, categoria: e.target.value }))}
                  />
                  <datalist id="categorias-despesa">
                    {CATEGORIAS_DESPESA.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                {fornecedores.length > 0 && (
                  <div>
                    <label className="label-field">Fornecedor (opcional)</label>
                    <select
                      className="input-field"
                      value={formPagar.fornecedorId}
                      onChange={(e) => setFormPagar((f) => ({ ...f, fornecedorId: e.target.value }))}
                    >
                      <option value="">Sem fornecedor</option>
                      {fornecedores.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.razao_social}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label-field">Nº do documento (opcional)</label>
                  <input
                    className="input-field"
                    value={formPagar.documentoNumero}
                    onChange={(e) => setFormPagar((f) => ({ ...f, documentoNumero: e.target.value }))}
                  />
                </div>
                {manutencoes.length > 0 && (
                  <div>
                    <label className="label-field">Manutenção vinculada (opcional)</label>
                    <select
                      className="input-field"
                      value={formPagar.manutencaoId}
                      onChange={(e) => setFormPagar((f) => ({ ...f, manutencaoId: e.target.value }))}
                    >
                      <option value="">Sem manutenção vinculada</option>
                      {manutencoes.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {chamados.length > 0 && (
                  <div>
                    <label className="label-field">Chamado vinculado (opcional)</label>
                    <select
                      className="input-field"
                      value={formPagar.chamadoId}
                      onChange={(e) => setFormPagar((f) => ({ ...f, chamadoId: e.target.value }))}
                    >
                      <option value="">Sem chamado vinculado</option>
                      {chamados.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="label-field">Nota fiscal / documento (opcional)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="input-field"
                    onChange={(e) => setArquivoPagar(e.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <label className="label-field">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={formPagar.valor}
                    onChange={(e) => setFormPagar((f) => ({ ...f, valor: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Competência (opcional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formPagar.dataCompetencia}
                    onChange={(e) => setFormPagar((f) => ({ ...f, dataCompetencia: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Vencimento (opcional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formPagar.dataVencimento}
                    onChange={(e) => setFormPagar((f) => ({ ...f, dataVencimento: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Pagamento (opcional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formPagar.dataPagamento}
                    onChange={(e) => setFormPagar((f) => ({ ...f, dataPagamento: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Forma de pagamento (opcional)</label>
                  <input
                    className="input-field"
                    list="formas-pagamento"
                    value={formPagar.formaPagamento}
                    onChange={(e) => setFormPagar((f) => ({ ...f, formaPagamento: e.target.value }))}
                  />
                  <datalist id="formas-pagamento">
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label-field">Status</label>
                  <select
                    className="input-field"
                    value={formPagar.status}
                    onChange={(e) => setFormPagar((f) => ({ ...f, status: e.target.value }))}
                  >
                    {STATUS_PAGAR_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_PAGAR_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Parcela (opcional)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formPagar.parcela}
                    onChange={(e) => setFormPagar((f) => ({ ...f, parcela: e.target.value }))}
                    placeholder="Ex: 1"
                  />
                </div>
                <div>
                  <label className="label-field">De quantas parcelas (opcional)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formPagar.qtdParcelas}
                    onChange={(e) => setFormPagar((f) => ({ ...f, qtdParcelas: e.target.value }))}
                    placeholder="Ex: 3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Observações (opcional)</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={formPagar.observacoes}
                    onChange={(e) => setFormPagar((f) => ({ ...f, observacoes: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" disabled={submittingPagar} className="btn-primary">
                    {enviandoArquivo ? "Enviando documento..." : submittingPagar ? "Salvando..." : "Registrar conta a pagar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <select className="input-field w-auto" value={filtroStatusPagar} onChange={(e) => setFiltroStatusPagar(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUS_PAGAR_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_PAGAR_LABELS[s]}
              </option>
            ))}
          </select>

          {contasPagarFiltradas.length === 0 ? (
            <div className="card text-center text-navy-400">Nenhuma conta a pagar registrada.</div>
          ) : (
            <div className="space-y-2">
              {contasPagarFiltradas.map((c) => {
                const vencimento = calcularStatusVencimento(c.data_vencimento, c.status, STATUS_PAGAR_FINAIS);
                return (
                  <div key={c.id} className="card flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy-900">{c.descricao}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PAGAR_STYLES[c.status]}`}>
                          {STATUS_PAGAR_LABELS[c.status]}
                        </span>
                        {vencimento && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VENCIMENTO_BADGE_STYLES[vencimento.nivel]}`}>
                            {vencimento.emoji} {vencimento.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-navy-400">
                        {[c.categoria, c.fornecedor_nome, c.parcela && `Parcela ${c.parcela}/${c.qtd_parcelas || "?"}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1 text-xs text-navy-400">
                        Vencimento: {c.data_vencimento ? new Date(`${c.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
                        {c.data_pagamento && <> · Pago em {new Date(`${c.data_pagamento}T00:00:00`).toLocaleDateString("pt-BR")}</>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-navy-900">{formatarMoeda(c.valor)}</p>
                      {podeEditar && !STATUS_PAGAR_FINAIS.includes(c.status) && (
                        <button onClick={() => handleStatusPagar(c, "pago")} className="mt-1 block text-xs font-semibold text-emerald-700 hover:underline">
                          Marcar como pago
                        </button>
                      )}
                      {c.documento_url && (
                        <button
                          onClick={() => handleVerDocumento(c)}
                          disabled={abrindoDocumentoId === c.id}
                          className="mt-1 block text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50"
                        >
                          {abrindoDocumentoId === c.id ? "Abrindo..." : "Ver documento"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && aba === "receber" && (
        <div className="space-y-4">
          {podeCriar && (
            <div className="card">
              <h2 className="font-display text-lg font-bold text-navy-900">Nova conta a receber</h2>
              <form onSubmit={handleCreateReceber} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label-field">Descrição</label>
                  <input
                    className="input-field"
                    value={formReceber.descricao}
                    onChange={(e) => setFormReceber((f) => ({ ...f, descricao: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Unidade (opcional)</label>
                  <input
                    className="input-field"
                    value={formReceber.unidade}
                    onChange={(e) => setFormReceber((f) => ({ ...f, unidade: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Morador/responsável (opcional)</label>
                  <input
                    className="input-field"
                    value={formReceber.responsavelFinanceiro}
                    onChange={(e) => setFormReceber((f) => ({ ...f, responsavelFinanceiro: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Categoria (opcional)</label>
                  <input
                    className="input-field"
                    list="categorias-receita"
                    value={formReceber.categoria}
                    onChange={(e) => setFormReceber((f) => ({ ...f, categoria: e.target.value }))}
                  />
                  <datalist id="categorias-receita">
                    {CATEGORIAS_RECEITA.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label-field">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={formReceber.valor}
                    onChange={(e) => setFormReceber((f) => ({ ...f, valor: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Competência (opcional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formReceber.dataCompetencia}
                    onChange={(e) => setFormReceber((f) => ({ ...f, dataCompetencia: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Vencimento (opcional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formReceber.dataVencimento}
                    onChange={(e) => setFormReceber((f) => ({ ...f, dataVencimento: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Recebimento (opcional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formReceber.dataRecebimento}
                    onChange={(e) => setFormReceber((f) => ({ ...f, dataRecebimento: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Valor recebido (opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={formReceber.valorRecebido}
                    onChange={(e) => setFormReceber((f) => ({ ...f, valorRecebido: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Desconto (opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={formReceber.desconto}
                    onChange={(e) => setFormReceber((f) => ({ ...f, desconto: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Juros/multa (opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={formReceber.jurosMulta}
                    onChange={(e) => setFormReceber((f) => ({ ...f, jurosMulta: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">Forma de pagamento (opcional)</label>
                  <input
                    className="input-field"
                    list="formas-pagamento-receber"
                    value={formReceber.formaPagamento}
                    onChange={(e) => setFormReceber((f) => ({ ...f, formaPagamento: e.target.value }))}
                  />
                  <datalist id="formas-pagamento-receber">
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label-field">Status</label>
                  <select
                    className="input-field"
                    value={formReceber.status}
                    onChange={(e) => setFormReceber((f) => ({ ...f, status: e.target.value }))}
                  >
                    {STATUS_RECEBER_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_RECEBER_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label-field">Observações (opcional)</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={formReceber.observacoes}
                    onChange={(e) => setFormReceber((f) => ({ ...f, observacoes: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" disabled={submittingReceber} className="btn-primary">
                    {submittingReceber ? "Salvando..." : "Registrar conta a receber"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <select className="input-field w-auto" value={filtroStatusReceber} onChange={(e) => setFiltroStatusReceber(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUS_RECEBER_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_RECEBER_LABELS[s]}
              </option>
            ))}
          </select>

          {contasReceberFiltradas.length === 0 ? (
            <div className="card text-center text-navy-400">Nenhuma conta a receber registrada.</div>
          ) : (
            <div className="space-y-2">
              {contasReceberFiltradas.map((c) => {
                const vencimento = calcularStatusVencimento(c.data_vencimento, c.status, STATUS_RECEBER_FINAIS);
                return (
                  <div key={c.id} className="card flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy-900">{c.descricao}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_RECEBER_STYLES[c.status]}`}>
                          {STATUS_RECEBER_LABELS[c.status]}
                        </span>
                        {vencimento && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VENCIMENTO_BADGE_STYLES[vencimento.nivel]}`}>
                            {vencimento.emoji} {vencimento.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-navy-400">
                        {[c.categoria, c.unidade, c.responsavel_financeiro].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1 text-xs text-navy-400">
                        Vencimento: {c.data_vencimento ? new Date(`${c.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
                        {c.data_recebimento && <> · Recebido em {new Date(`${c.data_recebimento}T00:00:00`).toLocaleDateString("pt-BR")}</>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-navy-900">{formatarMoeda(c.valor)}</p>
                      {podeEditar && !STATUS_RECEBER_FINAIS.includes(c.status) && (
                        <button onClick={() => handleStatusReceber(c, "recebida")} className="mt-1 text-xs font-semibold text-emerald-700 hover:underline">
                          Marcar como recebida
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && aba === "boletos" && (
        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-900">Boletos</h2>
          <p className="mt-2 text-navy-500">
            Em breve: geração e envio automático de boletos para as unidades do seu condomínio.
          </p>
        </div>
      )}
    </div>
    </ModuloGuard>
  );
}
