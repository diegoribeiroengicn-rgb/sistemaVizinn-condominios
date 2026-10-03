// Geração de relatórios (PDF/Word) — sempre a partir dos mesmos dados já
// mostrados na pré-visualização da tela (nunca busca de novo, nunca
// inventa valor). Cabeçalho, filtros aplicados e resumo seguem o mesmo
// formato em qualquer relatório do sistema.
//
// jsPDF/jspdf-autotable/docx são importados dinamicamente (import()
// dentro de cada função, nunca no topo do arquivo) porque juntos somam
// centenas de kB — como toda página que exporta relatório (Moradores,
// Colaboradores, Fornecedores, Relatórios) importa esse arquivo, um
// import estático no topo colocava esse peso todo no carregamento
// inicial dessas páginas, mesmo pra quem nunca clica em "exportar"
// (mesmo motivo/mesmo padrão do import dinâmico já usado em lib/xlsx.js).

import { formatarAlertaResumo } from "@/lib/inteligenciaFinanceira";

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

export async function gerarPdf(config) {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const { condominioNome, tipoLabel, periodoLabel, filtros, colunas, linhas, resumo, geradoEm, geradoPor } = config;
  const orientation = colunas.length > 6 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const margem = 40;
  let y = margem;

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("AQUIHABITTO", margem, y);
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
    doc.text(`AquiHabitto — página ${p} de ${totalPaginas}`, largura - margem, altura - 20, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`${gerarNomeArquivo(tipoLabel)}.pdf`);
}

// Relatório Financeiro de 1 página — diferente de gerarPdf (tabela
// genérica, usada por todos os outros módulos): aqui o formato é fixo
// e pensado pra caber numa página só, com gráficos desenhados direto
// no PDF (jsPDF não tem canvas/imagem disponível em build estático,
// então os gráficos são formas vetoriais simples — retângulo e linha —
// em vez de depender de uma lib de gráficos ou de rasterizar um
// canvas). Word não ganhou essa versão: tabela/texto não representa
// bem gráfico, e gerar imagem de gráfico pro docx exigiria renderizar
// canvas no servidor, o que esse projeto não tem hoje.
export async function gerarRelatorioFinanceiroPdf(config) {
  const { jsPDF } = await import("jspdf");
  const { condominioNome, periodoLabel, geradoEm, geradoPor, resumo, porMes, porCategoriaDespesa, alertasFinanceiros, observacoes } =
    config;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margem = 40;
  const largura = doc.internal.pageSize.getWidth();
  const larguraUtil = largura - margem * 2;
  let y = margem;

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("AQUIHABITTO", margem, y);
  y += 18;
  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text(condominioNome || "Condomínio", margem, y);
  y += 16;
  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  doc.text("RELATÓRIO FINANCEIRO", margem, y);
  y += 14;
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100);
  if (periodoLabel) {
    doc.text(`Período: ${periodoLabel}`, margem, y);
    y += 11;
  }
  doc.text(`Gerado em ${geradoEm.toLocaleString("pt-BR")} por ${geradoPor}`, margem, y);
  doc.setTextColor(0);
  y += 20;

  // Resumo — até 3 números principais lado a lado (Receitas/Despesas/Saldo).
  const resumoPrincipal = (resumo || []).slice(0, 3);
  if (resumoPrincipal.length > 0) {
    const colW = larguraUtil / resumoPrincipal.length;
    resumoPrincipal.forEach((item, i) => {
      const x = margem + i * colW;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(String(item.label), x, y);
      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.setTextColor(10, 31, 63);
      doc.text(String(item.valor), x, y + 18);
      doc.setFont(undefined, "normal");
      doc.setTextColor(0);
    });
    y += 38;
  }
  doc.setDrawColor(230);
  doc.line(margem, y, margem + larguraUtil, y);
  y += 22;

  // Gráfico 1 — Receitas x Despesas por mês (barras agrupadas).
  if (porMes && porMes.length > 0) {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Receitas x Despesas por mês", margem, y);
    y += 14;
    const chartH = 110;
    const chartBottom = y + chartH;
    const maxValor = Math.max(1, ...porMes.flatMap((m) => [m.receitas, m.despesas]));
    const groupW = larguraUtil / porMes.length;
    const barW = Math.min(16, groupW / 3);
    doc.setDrawColor(220);
    doc.line(margem, chartBottom, margem + larguraUtil, chartBottom);
    porMes.forEach((m, i) => {
      const gx = margem + i * groupW + groupW / 2;
      const hR = (m.receitas / maxValor) * (chartH - 10);
      const hD = (m.despesas / maxValor) * (chartH - 10);
      doc.setFillColor(16, 185, 129);
      doc.rect(gx - barW - 2, chartBottom - hR, barW, hR, "F");
      doc.setFillColor(228, 93, 78);
      doc.rect(gx + 2, chartBottom - hD, barW, hD, "F");
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(m.mes, gx, chartBottom + 12, { align: "center" });
      doc.setTextColor(0);
    });
    y = chartBottom + 22;
    doc.setFillColor(16, 185, 129);
    doc.rect(margem, y - 7, 8, 8, "F");
    doc.setFontSize(8);
    doc.text("Receitas", margem + 12, y);
    doc.setFillColor(228, 93, 78);
    doc.rect(margem + 72, y - 7, 8, 8, "F");
    doc.text("Despesas", margem + 84, y);
    y += 20;
  }

  // Gráfico 2 — Despesas por categoria (barras horizontais, até 6).
  if (porCategoriaDespesa && porCategoriaDespesa.length > 0) {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Despesas por categoria", margem, y);
    y += 14;
    const maxCat = Math.max(1, ...porCategoriaDespesa.map((c) => c.valor));
    const barMaxW = larguraUtil - 160;
    porCategoriaDespesa.forEach((c) => {
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.setTextColor(0);
      doc.text(c.categoria, margem, y + 7);
      const w = Math.max(2, (c.valor / maxCat) * barMaxW);
      doc.setFillColor(10, 31, 63);
      doc.rect(margem + 110, y, w, 10, "F");
      doc.text(
        c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        margem + 110 + w + 6,
        y + 7
      );
      y += 16;
    });
    y += 10;
  }

  // Inteligência Financeira — até 5 alertas em aberto, uma linha cada.
  if (alertasFinanceiros && alertasFinanceiros.length > 0) {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Inteligência Financeira", margem, y);
    y += 14;
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    for (const alerta of alertasFinanceiros.slice(0, 5)) {
      const linhas = doc.splitTextToSize(`• ${formatarAlertaResumo(alerta)}`, larguraUtil);
      doc.text(linhas, margem, y);
      y += linhas.length * 10 + 4;
    }
    y += 6;
  }

  // Observações — texto livre do síndico.
  if (observacoes) {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Observações", margem, y);
    y += 14;
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    const linhas = doc.splitTextToSize(observacoes, larguraUtil);
    doc.text(linhas, margem, y);
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "AquiHabitto — relatório de 1 página",
    largura - margem,
    doc.internal.pageSize.getHeight() - 20,
    { align: "right" }
  );

  doc.save(`${gerarNomeArquivo("financeiro-resumo")}.pdf`);
}

export async function gerarDocx(config) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType } = await import("docx");
  const { condominioNome, tipoLabel, periodoLabel, filtros, colunas, linhas, resumo, geradoEm, geradoPor } = config;

  const cabecalho = [
    new Paragraph({ text: "AQUIHABITTO", heading: HeadingLevel.HEADING_2 }),
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
