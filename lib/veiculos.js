// Cadastro de Veículos — carros/motos vinculados a uma unidade, cadastrados
// pelo síndico/administração (mesmo padrão do cadastro de Moradores: não
// depende do morador ter login). Ajuda a portaria a conferir se uma placa
// pertence a um morador antes de liberar a entrada.

import { parseCsvGenerico } from "@/lib/csv";
import { gerarModeloXlsx, parseXlsxGenerico } from "@/lib/xlsx";

export const TIPO_VEICULO_LABELS = { carro: "Carro", moto: "Moto", outro: "Outro" };

const MAPA_CAMPOS = {
  unidade: ["unidade", "unid", "apto", "apartamento", "casa", "numero", "número"],
  bloco: ["bloco", "torre", "quadra"],
  morador_nome: ["morador", "nome", "proprietario", "proprietário", "nome do morador"],
  placa: ["placa"],
  modelo: ["modelo"],
  cor: ["cor"],
  tipo: ["tipo", "categoria"],
  vaga: ["vaga", "garagem"],
};

// "opcao" (ver montarLinha em lib/csv.js) compara o texto da planilha com
// os rótulos de TIPO_VEICULO_LABELS, sem diferenciar maiúscula/acento —
// célula vazia ou tipo não escrito na planilha cai no padrão "carro".
const TIPOS_CAMPOS = {
  tipo: { tipo: "opcao", mapa: TIPO_VEICULO_LABELS, padrao: "carro" },
};

const OBRIGATORIOS = ["unidade", "morador_nome", "placa"];

const COLUNAS_MODELO = [
  { header: "Apartamento", key: "apartamento", width: 16, texto: true },
  { header: "Morador", key: "morador", width: 26 },
  { header: "Placa", key: "placa", width: 14, texto: true },
  { header: "Bloco", key: "bloco", width: 12 },
  { header: "Modelo", key: "modelo", width: 20 },
  { header: "Cor", key: "cor", width: 14 },
  { header: "Tipo", key: "tipo", width: 12 },
  { header: "Vaga", key: "vaga", width: 12, texto: true },
];

// Gera o modelo de planilha (.xlsx formatado, com cabeçalho em destaque
// e exemplos) pra download — abre certinho no Excel, sem confusão de
// separador de coluna.
export async function gerarModeloVeiculos() {
  return gerarModeloXlsx({
    nomeAba: "Veículos",
    colunas: COLUNAS_MODELO,
    linhasExemplo: [
      {
        apartamento: "101",
        morador: "Maria Silva",
        placa: "ABC1D23",
        bloco: "A",
        modelo: "Honda Civic",
        cor: "Prata",
        tipo: "Carro",
        vaga: "G-12",
      },
      {
        apartamento: "102",
        morador: "João Pereira",
        placa: "XYZ9K87",
        bloco: "A",
        modelo: "Honda CG",
        cor: "Preta",
        tipo: "Moto",
        vaga: "G-13",
      },
    ],
  });
}

// Lê um .xlsx (ArrayBuffer) e devolve { linhas, erros } — linhas já
// mapeadas pros campos de veiculos, prontas pra revisão antes de importar.
export function parseVeiculosXlsx(arrayBuffer) {
  return parseXlsxGenerico(arrayBuffer, { mapaCampos: MAPA_CAMPOS, obrigatorios: OBRIGATORIOS, tipos: TIPOS_CAMPOS });
}

// Mantido como alternativa pra quem exportar de outro programa (ex:
// Google Sheets) em .csv em vez de .xlsx.
export function parseVeiculosCsv(texto) {
  return parseCsvGenerico(texto, { mapaCampos: MAPA_CAMPOS, obrigatorios: OBRIGATORIOS, tipos: TIPOS_CAMPOS });
}

// Colunas do relatório (download da lista atual em PDF/Word) — ver
// lib/relatorios.js. "tipoLabel" é derivado antes de exportar (ver
// montarConfigRelatorio na página).
export const COLUNAS_RELATORIO = [
  { header: "Unidade", key: "unidade" },
  { header: "Bloco", key: "bloco" },
  { header: "Morador", key: "morador_nome" },
  { header: "Placa", key: "placa" },
  { header: "Modelo", key: "modelo" },
  { header: "Cor", key: "cor" },
  { header: "Tipo", key: "tipoLabel" },
  { header: "Vaga", key: "vaga" },
];
