// Planilha .xlsx (Excel de verdade, com formatação) pra download de
// modelo e leitura de planilha importada — usa ExcelJS (mantido
// ativamente, sem os problemas de segurança sem correção do pacote
// "xlsx"/SheetJS no npm; ver histórico do módulo Moradores). Funciona
// no navegador: o pacote tem um build específico pra isso.
//
// Importado dinamicamente (import() em vez de import no topo) porque a
// lib é grande (~250kB) — assim ela só é baixada quando alguém de fato
// clica em "baixar modelo" ou sobe um arquivo, não no carregamento
// normal da página de Moradores/Colaboradores.

import { normalizarCabecalho } from "@/lib/csv";

const COR_CABECALHO = "FF0A1F3F"; // navy-900, mesma cor usada nos relatórios PDF
const BORDA = { style: "thin", color: { argb: "FFD9DEE7" } };

// `colunas`: [{ header, key, width }] — width em "caracteres" (padrão do Excel).
// `linhasExemplo`: [{ key: valor }, ...] — algumas linhas de exemplo já preenchidas.
export async function gerarModeloXlsx({ nomeAba, colunas, linhasExemplo }) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(nomeAba);

  // Colunas marcadas como texto (telefone, apartamento) ficam com o
  // formato "@" — assim o Excel nunca reinterpreta o número digitado
  // como valor numérico (perderia zero à esquerda ou viraria notação
  // científica em números longos).
  sheet.columns = colunas.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || 20,
    style: c.texto ? { numFmt: "@" } : undefined,
  }));

  const linhaCabecalho = sheet.getRow(1);
  linhaCabecalho.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_CABECALHO } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { top: BORDA, left: BORDA, bottom: BORDA, right: BORDA };
  });
  linhaCabecalho.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const exemplo of linhasExemplo || []) {
    const row = sheet.addRow(exemplo);
    row.eachCell((cell) => {
      cell.border = { top: BORDA, left: BORDA, bottom: BORDA, right: BORDA };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

// Lê um .xlsx (ArrayBuffer) e devolve o mesmo formato que parseCsvGenerico:
// { linhas: [{campo: valor}], erros: [string] } — usa a primeira aba, a
// primeira linha como cabeçalho.
export async function parseXlsxGenerico(arrayBuffer, { mapaCampos, obrigatorios }) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) {
    return { linhas: [], erros: ["Planilha vazia."] };
  }

  const cabecalho = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cabecalho[colNumber - 1] = normalizarCabecalho(cell.text);
  });

  const indicePorCampo = {};
  for (const [campo, variacoes] of Object.entries(mapaCampos)) {
    const idx = cabecalho.findIndex((h) => variacoes.includes(h));
    if (idx >= 0) indicePorCampo[campo] = idx;
  }

  const faltando = obrigatorios.filter((campo) => indicePorCampo[campo] === undefined);
  if (faltando.length > 0) {
    return {
      linhas: [],
      erros: [`Não encontrei a(s) coluna(s) obrigatória(s) "${faltando.join(", ")}" no arquivo. Confira o cabeçalho da primeira linha.`],
    };
  }

  const linhas = [];
  const erros = [];
  for (let numeroLinha = 2; numeroLinha <= sheet.rowCount; numeroLinha++) {
    const linhaExcel = sheet.getRow(numeroLinha);
    if (linhaExcel.cellCount === 0) continue;

    const valores = [];
    linhaExcel.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      valores[colNumber - 1] = String(cell.text || "").trim();
    });
    if (valores.every((v) => !v)) continue; // linha em branco — ignora sem avisar

    const linha = {};
    for (const campo of Object.keys(mapaCampos)) {
      linha[campo] = indicePorCampo[campo] !== undefined ? valores[indicePorCampo[campo]] || "" : "";
    }
    const faltandoNaLinha = obrigatorios.some((campo) => !linha[campo]);
    if (faltandoNaLinha) {
      erros.push(`Linha ${numeroLinha}: faltando ${obrigatorios.join("/")} — ignorada.`);
      continue;
    }
    linhas.push(linha);
  }

  return { linhas, erros };
}
