// Constantes do módulo Colaboradores — pessoas que trabalham no
// condomínio, separado de `membros` (quem tem login no Vizinn). Um
// colaborador pode existir sem login algum.

import { parseCsvGenerico, gerarCsv } from "@/lib/csv";

const MAPA_CAMPOS_CSV = {
  nome: ["nome", "funcionario", "funcionário", "colaborador", "nome completo"],
  funcao: ["funcao", "função", "cargo"],
  setor: ["setor", "area", "área", "departamento"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail"],
};

// Lê o texto de um .csv (exportado do Excel/Google Sheets) e devolve
// { linhas, erros } — linhas mapeadas pra nome/funcao/setor/telefone/
// email, prontas pra revisão antes de importar. Campos não cobertos
// aqui (CPF, status, data de início...) ficam com o padrão e podem ser
// completados depois, editando o colaborador.
export function parseColaboradoresCsv(texto) {
  return parseCsvGenerico(texto, { mapaCampos: MAPA_CAMPOS_CSV, obrigatorios: ["nome", "funcao"] });
}

export function gerarModeloCsvColaboradores() {
  return gerarCsv(
    ["nome", "funcao", "setor", "telefone", "email"],
    [["João Souza", "Porteiro", "Portaria", "11988887777", "joao@email.com"]]
  );
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
