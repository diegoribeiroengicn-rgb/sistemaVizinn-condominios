// Gerador de proposta comercial em PDF (seção 14 do prompt de upgrade) —
// puro client-side, sem nenhuma chamada de API: não cria conta, não
// cobra nada, não reserva nada. É só um documento formatado com os
// mesmos preços já públicos (plano ou faixa Multicondomínios), pro
// vendedor mandar pro prospect. jsPDF importado dinamicamente, mesmo
// padrão/mesmo motivo do lib/relatorios.js.
export async function gerarPropostaComercialPdf({ prospectNome, condominioNome, vendedorNome, validadeDias, item }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margem = 48;
  let y = margem;

  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text("AQUIHABITTO", margem, y);
  y += 26;

  doc.setFontSize(14);
  doc.text("PROPOSTA COMERCIAL", margem, y);
  y += 24;

  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  const hoje = new Date();
  const validade = new Date(hoje.getTime() + (Number(validadeDias) || 7) * 24 * 60 * 60 * 1000);
  doc.text(`Data: ${hoje.toLocaleDateString("pt-BR")}`, margem, y);
  y += 14;
  doc.text(`Válida até: ${validade.toLocaleDateString("pt-BR")}`, margem, y);
  y += 14;
  if (vendedorNome) {
    doc.text(`Consultor(a): ${vendedorNome}`, margem, y);
    y += 14;
  }
  y += 10;

  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.text("Para:", margem, y);
  y += 16;
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  if (condominioNome) {
    doc.text(condominioNome, margem, y);
    y += 14;
  }
  if (prospectNome) {
    doc.text(prospectNome, margem, y);
    y += 14;
  }
  y += 12;

  doc.setDrawColor(10, 31, 63);
  doc.line(margem, y, 595 - margem, y);
  y += 24;

  doc.setFont(undefined, "bold");
  doc.setFontSize(13);
  doc.text(item.titulo, margem, y);
  y += 22;

  doc.setFont(undefined, "bold");
  doc.setFontSize(18);
  doc.text(
    `R$ ${Number(item.precoMensal).toFixed(2).replace(".", ",")}/mês`,
    margem,
    y
  );
  y += 22;

  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  if (item.descricao) {
    doc.text(item.descricao, margem, y, { maxWidth: 595 - margem * 2 });
    y += 16;
  }
  if (item.taxaAdesao != null) {
    doc.text(
      `Taxa de adesão (única, na ativação): R$ ${Number(item.taxaAdesao).toFixed(2).replace(".", ",")}`,
      margem,
      y
    );
    y += 16;
  }
  y += 8;

  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.text("O que está incluído:", margem, y);
  y += 18;
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  for (const f of item.features || []) {
    doc.text(`•  ${f}`, margem, y, { maxWidth: 595 - margem * 2 });
    y += 16;
  }
  y += 10;

  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.text("Condições comerciais:", margem, y);
  y += 18;
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  for (const c of [
    "14 dias de teste grátis a partir da ativação.",
    "Cancelamento a qualquer momento, sem multa.",
    "Pagamento via cartão ou boleto.",
    `Proposta válida até ${validade.toLocaleDateString("pt-BR")}; valores sujeitos a confirmação após esta data.`,
  ]) {
    doc.text(`•  ${c}`, margem, y, { maxWidth: 595 - margem * 2 });
    y += 16;
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("AquiHabitto — gestão de condomínios.", margem, 780);

  const slug = (condominioNome || prospectNome || "proposta").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  doc.save(`proposta-aquihabitto-${slug}.pdf`);
}
