// Constantes do módulo Colaboradores — pessoas que trabalham no
// condomínio, separado de `membros` (quem tem login no Vizinn). Um
// colaborador pode existir sem login algum.

import { parseCsvGenerico } from "@/lib/csv";
import { gerarModeloXlsx, parseXlsxGenerico } from "@/lib/xlsx";

const MAPA_CAMPOS_CSV = {
  nome: ["nome", "funcionario", "funcionário", "colaborador", "nome completo", "nome do funcionario"],
  funcao: ["funcao", "função", "cargo"],
  setor: ["setor", "area", "área", "departamento"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail"],
};

const COLUNAS_MODELO = [
  { header: "Nome do funcionário", key: "nome", width: 28 },
  { header: "Função", key: "funcao", width: 20 },
  { header: "Setor", key: "setor", width: 20 },
  { header: "Telefone", key: "telefone", width: 18, texto: true },
  { header: "Email", key: "email", width: 26 },
];

// Gera o modelo de planilha (.xlsx formatado, com cabeçalho em destaque
// e exemplos) pra download — abre certinho no Excel, sem confusão de
// separador de coluna. Campos não cobertos aqui (CPF, status, data de
// início...) ficam com o padrão e podem ser completados depois,
// editando o colaborador.
export async function gerarModeloColaboradores() {
  return gerarModeloXlsx({
    nomeAba: "Colaboradores",
    colunas: COLUNAS_MODELO,
    linhasExemplo: [
      { nome: "João Souza", funcao: "Porteiro", setor: "Portaria", telefone: "11988887777", email: "joao@email.com" },
      { nome: "Maria Lima", funcao: "Zelador", setor: "Manutenção", telefone: "11977776666", email: "maria.lima@email.com" },
    ],
  });
}

export function parseColaboradoresXlsx(arrayBuffer) {
  return parseXlsxGenerico(arrayBuffer, { mapaCampos: MAPA_CAMPOS_CSV, obrigatorios: ["nome", "funcao"] });
}

// Mantido como alternativa pra quem exportar de outro programa (ex:
// Google Sheets) em .csv em vez de .xlsx.
export function parseColaboradoresCsv(texto) {
  return parseCsvGenerico(texto, { mapaCampos: MAPA_CAMPOS_CSV, obrigatorios: ["nome", "funcao"] });
}

// Colunas do relatório (download da lista atual em PDF/Word) — ver
// lib/relatorios.js.
export const COLUNAS_RELATORIO = [
  { header: "Nome", key: "nome" },
  { header: "Função", key: "funcao" },
  { header: "Setor", key: "setor" },
  { header: "Status", key: "statusLabel" },
  { header: "Telefone", key: "telefone" },
  { header: "E-mail", key: "email" },
];

export const FUNCAO_SUGESTOES = [
  "Síndico",
  "Subsíndico",
  "Administrador",
  "Zelador",
  "Subzelador",
  "Porteiro",
  "Auxiliar de serviços gerais",
  "Equipe de limpeza",
  "Manutenção",
  "Segurança",
  "Outros",
];

export const STATUS_ORDER = ["ativo", "ferias", "afastado", "inativo"];
export const STATUS_LABELS = {
  ativo: "Ativo",
  ferias: "Férias",
  afastado: "Afastado",
  inativo: "Inativo",
};
export const STATUS_STYLES = {
  ativo: "bg-emerald-100 text-emerald-700",
  ferias: "bg-amber-100 text-amber-700",
  afastado: "bg-navy-100 text-navy-600",
  inativo: "bg-navy-100 text-navy-400",
};

// Formata telefone/whatsapp padronizado (DDI + DDD + número) só pra
// exibição — os campos ficam separados no banco pra facilitar uma futura
// integração de automação por WhatsApp.
export function formatarWhatsapp(colaborador) {
  const { whatsapp_ddi, whatsapp_ddd, whatsapp_numero } = colaborador || {};
  if (!whatsapp_numero) return null;
  const ddi = whatsapp_ddi || "55";
  return [ddi && `+${ddi}`, whatsapp_ddd && `(${whatsapp_ddd})`, whatsapp_numero].filter(Boolean).join(" ");
}
