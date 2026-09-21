// Constantes do módulo Fornecedores.

import { parseCsvGenerico } from "@/lib/csv";
import { gerarModeloXlsx, parseXlsxGenerico } from "@/lib/xlsx";

export const TIPO_LABELS = { empresa: "Empresa", profissional: "Profissional" };

export const STATUS_ORDER = ["ativo", "em_avaliacao", "inativo", "bloqueado"];
export const STATUS_LABELS = {
  ativo: "Ativo",
  inativo: "Inativo",
  em_avaliacao: "Em avaliação",
  bloqueado: "Bloqueado",
};
export const STATUS_STYLES = {
  ativo: "bg-emerald-100 text-emerald-700",
  inativo: "bg-navy-100 text-navy-500",
  em_avaliacao: "bg-amber-100 text-amber-700",
  bloqueado: "bg-coral-100 text-coral-700",
};

export const CATEGORIAS_SUGERIDAS = [
  "Combate a incêndio",
  "SPDA / Para-raios",
  "Extintores",
  "Sistemas de alarme e detecção",
  "Elevadores",
  "Bombas",
  "Elétrica",
  "Hidráulica",
  "Civil/Estrutural",
  "Portões",
  "Segurança",
  "Dedetização / Controle de pragas",
  "Limpeza de piscina",
  "Limpeza de caixa d'água",
  "Limpeza",
  "Jardinagem",
  "Equipamentos",
  "Materiais",
  "TI",
  "Outros",
];

export const CRITERIOS_AVALIACAO = [
  { chave: "nota_qualidade", label: "Qualidade" },
  { chave: "nota_prazo", label: "Cumprimento do prazo" },
  { chave: "nota_custo", label: "Custo" },
  { chave: "nota_atendimento", label: "Atendimento" },
];

// Média simples dos 4 critérios de cada avaliação, depois média simples
// entre avaliações — nada de ranking ponderado ou algoritmo complexo.
export function calcularNotaMedia(avaliacoes) {
  if (!avaliacoes || avaliacoes.length === 0) return null;
  const total = avaliacoes.reduce((soma, a) => {
    const media = (a.nota_qualidade + a.nota_prazo + a.nota_custo + a.nota_atendimento) / 4;
    return soma + media;
  }, 0);
  return total / avaliacoes.length;
}

// Importação/exportação por planilha — mesmo padrão de Moradores e
// Colaboradores (ver lib/csv.js e lib/xlsx.js).

const MAPA_CAMPOS_CSV = {
  nome: ["nome", "razao social", "empresa", "fornecedor", "nome da empresa"],
  telefone: ["telefone", "telefone da empresa", "celular", "fone", "contato"],
  vendedor: ["vendedor", "vendedor da empresa", "representante"],
  vendedorContato: ["contato do vendedor", "telefone do vendedor", "whatsapp do vendedor", "contato vendedor"],
  cnpj: ["cnpj", "documento", "cpf/cnpj", "cpf"],
  atividade: ["atividade", "atividade da empresa", "categoria", "ramo"],
};

const COLUNAS_MODELO = [
  { header: "Nome da empresa", key: "nome", width: 28 },
  { header: "Telefone da empresa", key: "telefone", width: 20, texto: true },
  { header: "Vendedor da empresa", key: "vendedor", width: 24 },
  { header: "Contato do vendedor", key: "vendedorContato", width: 20, texto: true },
  { header: "CNPJ", key: "cnpj", width: 20, texto: true },
  { header: "Atividade da empresa", key: "atividade", width: 24 },
];

// Gera o modelo de planilha (.xlsx formatado, com cabeçalho em destaque
// e exemplos) pra download.
export async function gerarModeloFornecedores() {
  return gerarModeloXlsx({
    nomeAba: "Fornecedores",
    colunas: COLUNAS_MODELO,
    linhasExemplo: [
      {
        nome: "Elevadores Rápidos Ltda",
        telefone: "1133334444",
        vendedor: "Carlos Souza",
        vendedorContato: "11988887777",
        cnpj: "12345678000199",
        atividade: "Elevadores",
      },
      {
        nome: "Jardim Bonito Paisagismo",
        telefone: "1122223333",
        vendedor: "Ana Paula",
        vendedorContato: "11977776666",
        cnpj: "98765432000188",
        atividade: "Jardinagem",
      },
    ],
  });
}

export function parseFornecedoresXlsx(arrayBuffer) {
  return parseXlsxGenerico(arrayBuffer, { mapaCampos: MAPA_CAMPOS_CSV, obrigatorios: ["nome"] });
}

// Mantido como alternativa pra quem exportar de outro programa (ex:
// Google Sheets) em .csv em vez de .xlsx.
export function parseFornecedoresCsv(texto) {
  return parseCsvGenerico(texto, { mapaCampos: MAPA_CAMPOS_CSV, obrigatorios: ["nome"] });
}

// Colunas do relatório (download da lista atual em PDF/Word) — ver
// lib/relatorios.js.
export const COLUNAS_RELATORIO = [
  { header: "Nome", key: "razao_social" },
  { header: "Telefone", key: "telefone" },
  { header: "Vendedor", key: "vendedor_nome" },
  { header: "Contato do vendedor", key: "vendedor_contato" },
  { header: "CNPJ", key: "documento" },
  { header: "Atividade", key: "categoria" },
  { header: "Status", key: "statusLabel" },
];
