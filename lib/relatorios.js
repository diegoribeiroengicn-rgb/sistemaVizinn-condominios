// Geração de relatórios (PDF/Word) — sempre a partir dos mesmos dados já
// mostrados na pré-visualização da tela (nunca busca de novo, nunca
// inventa valor). Cabeçalho, filtros aplicados e resumo seguem o mesmo
// formato em qualquer relatório do sistema.

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType } from "docx";

// { condominioNome, tipoLabel, periodoLabel, filtros: [{label,valor}],
//   colunas: [{header,key}], linhas: [obj], resumo: [{label,valor}],
//   geradoEm: Date, geradoPor: string }
export function gerarNomeArquivo(tipoLabel) {
  const slug = tipoLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
  const agora = new Date().toISOString().slice(0, 10);
  return `relatorio-${slug}-${agora}`;
}

export function gerarPdf(config) {
  const { condominioNome, tipoLabel, periodoLabel, filtros, colunas, linhas, resumo, geradoEm, geradoPor } = config;
  const orientation = colunas.length > 6 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const margem = 40;
  let y = margem;

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("VIZINN", margem, y);
  y += 20;
  doc.setFontSize(12);
  doc.text(condominioNome || "Condomínio", margem, y);
  y += 22;

  doc.setFontSize(13);
  doc.text(`RELATÓRIO DE ${tipoLabel.toUpperCase()}`, margem, y);
  y += 18;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  if (periodoLabel) {
    doc.text(`Período: ${periodoLabel}`, margem, y);
    y += 13;
  }
  for (const f of filtros || []) {
    if (!f.valor) continue;
    doc.text(`${f.label}: ${f.valor}`, margem, y);
    y += 13;
  }
  doc.text(`Gerado em: ${geradoEm.toLocaleString("pt-BR")}`, margem, y);
  y += 13;
  doc.text(`Gerado por: ${geradoPor}`, margem, y);
  y += 16;

  if (linhas.length === 0) {
    doc.setFontSize(11);
    doc.text("Nenhum registro encontrado para os filtros selecionados.", margem, y);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem },
      head: [colunas.map((c) => c.header)],
      body: linhas.map((linha) => colunas.map((c) => (linha[c.key] ?? "-").toString())),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [10, 31, 63] },
      theme: "grid",
    });
  }

  if (resumo && resumo.length > 0) {
    const finalY = linhas.length === 0 ? y + 20 : doc.lastAutoTable.finalY + 20;
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Resumo", margem, finalY);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    resumo.forEach((item, i) => {
      doc.text(`${item.label}: ${item.valor}`, margem, finalY + 16 + i * 13);
    });
  }

  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    const largura = doc.internal.pageSize.getWidth();
    const altura = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Vizinn — página ${p} de ${totalPaginas}`, largura - margem, altura - 20, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`${gerarNomeArquivo(tipoLabel)}.pdf`);
}

export async function gerarDocx(config) {
  const { condominioNome, tipoLabel, periodoLabel, filtros, colunas, linhas, resumo, geradoEm, geradoPor } = config;

  const cabecalho = [
    new Paragraph({ text: "VIZINN", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: condominioNome || "Condomínio" }),
    new Paragraph({ text: `RELATÓRIO DE ${tipoLabel.toUpperCase()}`, heading: HeadingLevel.HEADING_1 }),
  ];

  if (periodoLabel) cabecalho.push(new Paragraph({ text: `Período: ${periodoLabel}` }));
  for (const f of filtros || []) {
    if (!f.valor) continue;
    cabecalho.push(new Paragraph({ text: `${f.label}: ${f.valor}` }));
  }
  cabecalho.push(new Paragraph({ text: `Gerado em: ${geradoEm.toLocaleString("pt-BR")}` }));
  cabecalho.push(new Paragraph({ text: `Gerado por: ${geradoPor}`, spacing: { after: 200 } }));

  const corpo = [];
  if (linhas.length === 0) {
    corpo.push(new Paragraph({ text: "Nenhum registro encontrado para os filtros selecionados." }));
  } else {
    const linhaCabecalho = new TableRow({
      children: colunas.map(
        (c) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: c.header, bold: true })] })],
          })
      ),
    });
    const linhasTabela = linhas.map(
      (linha) =>
        new TableRow({
          children: colunas.map(
            (c) => new TableCell({ children: [new Paragraph((linha[c.key] ?? "-").toString())] })
          ),
        })
    );
    corpo.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [linhaCabecalho, ...linhasTabela],
      })
    );
  }

  const rodape = [];
  if (resumo && resumo.length > 0) {
    rodape.push(new Paragraph({ text: "Resumo", heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }));
    for (const item of resumo) rodape.push(new Paragraph({ text: `${item.label}: ${item.valor}` }));
  }

  const doc = new Document({
    sections: [{ children: [...cabecalho, ...corpo, ...rodape] }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${gerarNomeArquivo(tipoLabel)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
