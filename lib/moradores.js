// Cadastro de Moradores — unidade/bloco/nome/telefone de quem mora no
// condomínio, separado de `membros` (quem tem login no Vizinn). Alimenta
// as notificações de Ocorrências (ver /app/api/notificar), que agora
// avisam qualquer morador cadastrado aqui, não só quem tem login.

import { parseCsvGenerico } from "@/lib/csv";
import { gerarModeloXlsx, parseXlsxGenerico } from "@/lib/xlsx";

const MAPA_CAMPOS = {
  unidade: ["unidade", "unid", "apto", "apartamento", "casa", "numero", "número"],
  bloco: ["bloco", "torre", "quadra"],
  nome: ["nome", "morador", "residente", "nome completo", "nome do morador"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail"],
};

const COLUNAS_MODELO = [
  { header: "Apartamento", key: "apartamento", width: 16, texto: true },
  { header: "Nome do morador", key: "nome", width: 28 },
  { header: "Bloco", key: "bloco", width: 12 },
  { header: "Telefone", key: "telefone", width: 18, texto: true },
  { header: "Email", key: "email", width: 26 },
];

// Gera o modelo de planilha (.xlsx formatado, com cabeçalho em destaque
// e exemplos) pra download — abre certinho no Excel, sem confusão de
// separador de coluna.
export async function gerarModeloMoradores() {
  return gerarModeloXlsx({
    nomeAba: "Moradores",
    colunas: COLUNAS_MODELO,
    linhasExemplo: [
      { apartamento: "101", nome: "Maria Silva", bloco: "A", telefone: "11999998888", email: "maria@email.com" },
      { apartamento: "102", nome: "João Pereira", bloco: "A", telefone: "11988887777", email: "joao@email.com" },
    ],
  });
}

// Lê um .xlsx (ArrayBuffer) e devolve { linhas, erros } — linhas já
// mapeadas pros campos unidade/bloco/nome/telefone/email, prontas pra
// revisão antes de importar.
export function parseMoradoresXlsx(arrayBuffer) {
  return parseXlsxGenerico(arrayBuffer, { mapaCampos: MAPA_CAMPOS, obrigatorios: ["unidade", "nome"] });
}

// Mantido como alternativa pra quem exportar de outro programa (ex:
// Google Sheets) em .csv em vez de .xlsx.
export function parseMoradoresCsv(texto) {
  return parseCsvGenerico(texto, { mapaCampos: MAPA_CAMPOS, obrigatorios: ["unidade", "nome"] });
}

// Colunas do relatório (download da lista atual em PDF/Word) — ver
// lib/relatorios.js.
export const COLUNAS_RELATORIO = [
  { header: "Unidade", key: "unidade" },
  { header: "Bloco", key: "bloco" },
  { header: "Nome", key: "nome" },
  { header: "Telefone", key: "telefone" },
  { header: "E-mail", key: "email" },
];
