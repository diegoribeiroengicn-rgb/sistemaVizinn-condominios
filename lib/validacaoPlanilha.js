// Validação de campos numéricos/data ao importar planilha — usado pelo
// Financeiro (Contas a Pagar/Receber), que precisa validar valor e datas
// além de texto simples. Compartilhado entre lib/csv.js e lib/xlsx.js.

// Aceita "1234.56", "1234,56", "1.234,56" (formato brasileiro) e devolve
// um Number, ou null se não for um número válido.
export function parseNumeroBr(bruto) {
  if (bruto == null) return null;
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
  const texto = String(bruto).trim();
  if (!texto) return null;

  let normalizado = texto.replace(/[^\d,.\-]/g, "");
  const temVirgula = normalizado.includes(",");
  const temPonto = normalizado.includes(".");
  if (temVirgula && temPonto) {
    // "1.234,56" — ponto é separador de milhar, vírgula é decimal.
    normalizado = normalizado.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    // "1234,56" — vírgula é decimal.
    normalizado = normalizado.replace(",", ".");
  }
  // Só ponto: já está no formato que Number() entende.

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

// Aceita "dd/mm/yyyy", "dd-mm-yyyy" e "yyyy-mm-dd", valida se a data
// existe de verdade (não deixa passar "31/02/2026") e devolve no
// formato ISO "yyyy-mm-dd" que o banco espera, ou null se inválida.
export function parseDataBr(bruto) {
  if (bruto == null) return null;
  if (bruto instanceof Date && !isNaN(bruto)) {
    return bruto.toISOString().slice(0, 10);
  }
  const texto = String(bruto).trim();
  if (!texto) return null;

  let dia, mes, ano;
  let m = texto.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) {
    [, dia, mes, ano] = m;
  } else {
    m = texto.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
    if (m) [, ano, mes, dia] = m;
  }
  if (!m) return null;

  dia = Number(dia);
  mes = Number(mes);
  ano = Number(ano);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2100) return null;

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return null; // ex: 31/02 vira 02/03 quando construído — aqui pega essa inconsistência
  }
  return data.toISOString().slice(0, 10);
}
