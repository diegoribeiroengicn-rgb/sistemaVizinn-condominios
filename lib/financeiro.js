// Constantes do módulo Financeiro (Contas a Pagar / Contas a Receber /
// Balanço) — categorias sugeridas, status e o indicador visual de
// vencimento (mesmo padrão 🟢🟡🔴 já usado em Chamados).

import { normalizarCabecalho, parseCsvGenerico } from "@/lib/csv";
import { gerarModeloXlsx, parseXlsxGenerico } from "@/lib/xlsx";

export const CATEGORIAS_RECEITA = [
  "Cotas condominiais",
  "Multas",
  "Juros",
  "Aluguel de áreas",
  "Eventos",
  "Outras receitas",
];

export const CATEGORIAS_DESPESA = [
  "Água",
  "Energia",
  "Funcionários",
  "Limpeza",
  "Segurança",
  "Manutenção",
  "Elevadores",
  "Combate a incêndio",
  "SPDA",
  "Jardinagem",
  "Piscina",
  "Dedetização",
  "Materiais",
  "Obras",
  "Administrativas",
  "Outras despesas",
];

export const FORMAS_PAGAMENTO = ["Boleto", "PIX", "Transferência", "Cartão", "Dinheiro", "Débito automático"];

export const STATUS_PAGAR_ORDER = ["pendente", "a_vencer", "vencida", "pago", "cancelada"];
export const STATUS_PAGAR_LABELS = {
  pendente: "Pendente",
  a_vencer: "A vencer",
  vencida: "Vencida",
  pago: "Pago",
  cancelada: "Cancelada",
};
export const STATUS_PAGAR_STYLES = {
  pendente: "bg-navy-100 text-navy-600",
  a_vencer: "bg-amber-100 text-amber-700",
  vencida: "bg-coral-100 text-coral-700",
  pago: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-navy-100 text-navy-400",
};
export const STATUS_PAGAR_FINAIS = ["pago", "cancelada"];

export const STATUS_RECEBER_ORDER = ["pendente", "a_vencer", "vencida", "recebida", "cancelada"];
export const STATUS_RECEBER_LABELS = {
  pendente: "Pendente",
  a_vencer: "A vencer",
  vencida: "Vencida",
  recebida: "Recebida",
  cancelada: "Cancelada",
};
export const STATUS_RECEBER_STYLES = {
  pendente: "bg-navy-100 text-navy-600",
  a_vencer: "bg-amber-100 text-amber-700",
  vencida: "bg-coral-100 text-coral-700",
  recebida: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-navy-100 text-navy-400",
};
export const STATUS_RECEBER_FINAIS = ["recebida", "cancelada"];

export const VENCIMENTO_BADGE_STYLES = {
  verde: "bg-emerald-100 text-emerald-700",
  amarelo: "bg-amber-100 text-amber-700",
  vermelho: "bg-coral-100 text-coral-700",
};

// 🟢 dentro do prazo · 🟡 vence em até 5 dias · 🔴 vencida. Contas já
// pagas/recebidas/canceladas não têm indicador.
export function calcularStatusVencimento(dataVencimento, status, statusFinais) {
  if (!dataVencimento || statusFinais.includes(status)) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(`${dataVencimento}T00:00:00`);
  const diasRestantes = Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) return { nivel: "vermelho", emoji: "🔴", label: "Vencida" };
  if (diasRestantes <= 5) return { nivel: "amarelo", emoji: "🟡", label: "Vence em breve" };
  return { nivel: "verde", emoji: "🟢", label: "Em dia" };
}

export function formatarMoeda(valor) {
  if (valor == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatarDataBr(isoOuNulo) {
  if (!isoOuNulo) return "";
  const [ano, mes, dia] = isoOuNulo.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Acusa como duplicata quando descrição + valor + vencimento batem com
// um lançamento já existente — só um alerta (não bloqueia a
// importação): pode ser mesmo um lançamento repetido de propósito.
function marcarDuplicados(linhas, existentes, camposChave) {
  const chaveDe = (obj, campos) =>
    campos.map((c) => normalizarCabecalho(String(obj[c] ?? ""))).join("|");
  const chavesExistentes = new Set(existentes.map((e) => chaveDe(e, camposChave.existentes)));
  return linhas.map((l) => ({ ...l, duplicado: chavesExistentes.has(chaveDe(l, camposChave.novos)) }));
}

// ---------------------------------------------------------------------
// Contas a Pagar — importação/exportação por planilha.

const MAPA_CAMPOS_PAGAR = {
  descricao: ["descricao"],
  categoria: ["categoria"],
  fornecedor: ["fornecedor", "fornecedor nome"],
  documentoNumero: ["documento", "numero do documento", "nota fiscal", "documento numero"],
  dataCompetencia: ["competencia"],
  dataVencimento: ["vencimento"],
  dataPagamento: ["pagamento", "data de pagamento"],
  valor: ["valor"],
  formaPagamento: ["forma de pagamento"],
  status: ["status"],
  observacoes: ["observacoes"],
};

const TIPOS_PAGAR = {
  dataCompetencia: "data",
  dataVencimento: "data",
  dataPagamento: "data",
  valor: "numero",
  status: { tipo: "opcao", mapa: STATUS_PAGAR_LABELS, padrao: "pendente" },
};

const COLUNAS_MODELO_PAGAR = [
  { header: "Descrição", key: "descricao", width: 28 },
  { header: "Categoria", key: "categoria", width: 18 },
  { header: "Fornecedor", key: "fornecedor", width: 24 },
  { header: "Documento", key: "documentoNumero", width: 16, texto: true },
  { header: "Competência", key: "dataCompetencia", width: 14 },
  { header: "Vencimento", key: "dataVencimento", width: 14 },
  { header: "Pagamento", key: "dataPagamento", width: 14 },
  { header: "Valor", key: "valor", width: 14 },
  { header: "Forma de pagamento", key: "formaPagamento", width: 20 },
  { header: "Status", key: "status", width: 14 },
  { header: "Observações", key: "observacoes", width: 28 },
];

// Baixa a planilha — com os lançamentos atuais quando já existirem, ou
// só o cabeçalho (servindo de modelo) quando a lista estiver vazia.
export async function gerarPlanilhaContasPagar(contas) {
  const linhas = contas.map((c) => ({
    descricao: c.descricao,
    categoria: c.categoria || "",
    fornecedor: c.fornecedor_nome || "",
    documentoNumero: c.documento_numero || "",
    dataCompetencia: formatarDataBr(c.data_competencia),
    dataVencimento: formatarDataBr(c.data_vencimento),
    dataPagamento: formatarDataBr(c.data_pagamento),
    valor: Number(c.valor),
    formaPagamento: c.forma_pagamento || "",
    status: STATUS_PAGAR_LABELS[c.status] || c.status,
    observacoes: c.observacoes || "",
  }));
  return gerarModeloXlsx({ nomeAba: "Contas a Pagar", colunas: COLUNAS_MODELO_PAGAR, linhasExemplo: linhas });
}

function marcarDuplicadosPagar(resultado, existentes) {
  const linhas = marcarDuplicados(resultado.linhas, existentes, {
    novos: ["descricao", "valor", "dataVencimento"],
    existentes: ["descricao", "valor", "data_vencimento"],
  });
  return { linhas, erros: resultado.erros };
}

export async function parseContasPagarXlsx(arrayBuffer, existentes) {
  const resultado = await parseXlsxGenerico(arrayBuffer, {
    mapaCampos: MAPA_CAMPOS_PAGAR,
    obrigatorios: ["descricao", "valor"],
    tipos: TIPOS_PAGAR,
  });
  return marcarDuplicadosPagar(resultado, existentes);
}

export function parseContasPagarCsv(texto, existentes) {
  const resultado = parseCsvGenerico(texto, {
    mapaCampos: MAPA_CAMPOS_PAGAR,
    obrigatorios: ["descricao", "valor"],
    tipos: TIPOS_PAGAR,
  });
  return marcarDuplicadosPagar(resultado, existentes);
}

// ---------------------------------------------------------------------
// Contas a Receber — importação/exportação por planilha.

const MAPA_CAMPOS_RECEBER = {
  descricao: ["descricao"],
  unidade: ["unidade"],
  responsavelFinanceiro: ["morador", "morador/responsavel", "responsavel", "responsavel financeiro"],
  categoria: ["categoria"],
  dataCompetencia: ["competencia"],
  dataVencimento: ["vencimento"],
  dataRecebimento: ["recebimento", "data de recebimento", "pagamento", "data de pagamento"],
  valor: ["valor"],
  valorRecebido: ["valor recebido"],
  desconto: ["desconto"],
  jurosMulta: ["juros", "juros/multa", "multa"],
  formaPagamento: ["forma de pagamento"],
  status: ["status"],
  observacoes: ["observacoes"],
};

const TIPOS_RECEBER = {
  dataCompetencia: "data",
  dataVencimento: "data",
  dataRecebimento: "data",
  valor: "numero",
  valorRecebido: "numero",
  desconto: "numero",
  jurosMulta: "numero",
  status: { tipo: "opcao", mapa: STATUS_RECEBER_LABELS, padrao: "pendente" },
};

const COLUNAS_MODELO_RECEBER = [
  { header: "Descrição", key: "descricao", width: 28 },
  { header: "Unidade", key: "unidade", width: 12, texto: true },
  { header: "Morador/responsável", key: "responsavelFinanceiro", width: 24 },
  { header: "Categoria", key: "categoria", width: 18 },
  { header: "Competência", key: "dataCompetencia", width: 14 },
  { header: "Vencimento", key: "dataVencimento", width: 14 },
  { header: "Data de pagamento", key: "dataRecebimento", width: 16 },
  { header: "Valor", key: "valor", width: 14 },
  { header: "Valor recebido", key: "valorRecebido", width: 14 },
  { header: "Desconto", key: "desconto", width: 12 },
  { header: "Juros/multa", key: "jurosMulta", width: 12 },
  { header: "Forma de pagamento", key: "formaPagamento", width: 20 },
  { header: "Status", key: "status", width: 14 },
  { header: "Observações", key: "observacoes", width: 28 },
];

export async function gerarPlanilhaContasReceber(contas) {
  const linhas = contas.map((c) => ({
    descricao: c.descricao,
    unidade: c.unidade || "",
    responsavelFinanceiro: c.responsavel_financeiro || "",
    categoria: c.categoria || "",
    dataCompetencia: formatarDataBr(c.data_competencia),
    dataVencimento: formatarDataBr(c.data_vencimento),
    dataRecebimento: formatarDataBr(c.data_recebimento),
    valor: Number(c.valor),
    valorRecebido: c.valor_recebido != null ? Number(c.valor_recebido) : "",
    desconto: c.desconto != null ? Number(c.desconto) : "",
    jurosMulta: c.juros_multa != null ? Number(c.juros_multa) : "",
    formaPagamento: c.forma_pagamento || "",
    status: STATUS_RECEBER_LABELS[c.status] || c.status,
    observacoes: c.observacoes || "",
  }));
  return gerarModeloXlsx({ nomeAba: "Contas a Receber", colunas: COLUNAS_MODELO_RECEBER, linhasExemplo: linhas });
}

function marcarDuplicadosReceber(resultado, existentes) {
  const linhas = marcarDuplicados(resultado.linhas, existentes, {
    novos: ["descricao", "valor", "dataVencimento"],
    existentes: ["descricao", "valor", "data_vencimento"],
  });
  return { linhas, erros: resultado.erros };
}

export async function parseContasReceberXlsx(arrayBuffer, existentes) {
  const resultado = await parseXlsxGenerico(arrayBuffer, {
    mapaCampos: MAPA_CAMPOS_RECEBER,
    obrigatorios: ["descricao", "valor"],
    tipos: TIPOS_RECEBER,
  });
  return marcarDuplicadosReceber(resultado, existentes);
}

export function parseContasReceberCsv(texto, existentes) {
  const resultado = parseCsvGenerico(texto, {
    mapaCampos: MAPA_CAMPOS_RECEBER,
    obrigatorios: ["descricao", "valor"],
    tipos: TIPOS_RECEBER,
  });
  return marcarDuplicadosReceber(resultado, existentes);
}
