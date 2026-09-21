// Cadastro de Moradores — unidade/bloco/nome/telefone de quem mora no
// condomínio, separado de `membros` (quem tem login no Vizinn). Alimenta
// as notificações de Ocorrências (ver /app/api/notificar), que agora
// avisam qualquer morador cadastrado aqui, não só quem tem login.

import { parseCsvGenerico, gerarCsv } from "@/lib/csv";

const MAPA_CAMPOS = {
  unidade: ["unidade", "unid", "apto", "apartamento", "casa", "numero", "número"],
  bloco: ["bloco", "torre", "quadra"],
  nome: ["nome", "morador", "residente", "nome completo", "nome do morador"],
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
// preencheu uma planilha assim a saber o formato esperado. Colunas em
// separado (ponto e vírgula) e com um exemplo em cada uma, pra abrir
// certinho no Excel em português.
export function gerarModeloCsv() {
  return gerarCsv(
    ["apartamento", "nome do morador", "bloco", "telefone", "email"],
    [
      ["101", "Maria Silva", "A", "11999998888", "maria@email.com"],
      ["102", "João Pereira", "A", "11988887777", "joao@email.com"],
    ]
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
