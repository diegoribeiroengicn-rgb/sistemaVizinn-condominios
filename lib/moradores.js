// Cadastro de Moradores — unidade/bloco/nome/telefone de quem mora no
// condomínio, separado de `membros` (quem tem login no Vizinn). Alimenta
// as notificações de Ocorrências (ver /app/api/notificar), que agora
// avisam qualquer morador cadastrado aqui, não só quem tem login.

import { parseCsvGenerico, gerarCsv } from "@/lib/csv";

const MAPA_CAMPOS = {
  unidade: ["unidade", "unid", "apto", "apartamento", "casa", "numero", "número"],
  bloco: ["bloco", "torre", "quadra"],
  nome: ["nome", "morador", "residente", "nome completo"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail"],
};

// Lê o texto de um .csv (exportado do Excel/Google Sheets) e devolve
// { linhas, erros } — linhas já mapeadas pros campos unidade/bloco/nome/
// telefone/email, prontas pra revisão antes de importar.
export function parseMoradoresCsv(texto) {
  return parseCsvGenerico(texto, { mapaCampos: MAPA_CAMPOS, obrigatorios: ["unidade", "nome"] });
}

// Gera o CSV de modelo (com um exemplo) pra download — ajuda quem nunca
// preencheu uma planilha assim a saber o formato esperado.
export function gerarModeloCsv() {
  return gerarCsv(
    ["unidade", "bloco", "nome", "telefone", "email"],
    [["101", "A", "Maria Silva", "11999998888", "maria@email.com"]]
  );
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
