// Constantes e cálculo de desconto de cupom — compartilhado entre as
// rotas públicas de cadastro e o painel admin. Cupons vivem só no
// Vizinn (não são objetos nativos do Stripe); a cobrança em si passa
// pelo Stripe normalmente, com o valor final já calculado aqui.
export const TIPO_CUPOM_LABELS = {
  percentual: "Percentual (%)",
  valor_fixo: "Valor fixo (R$)",
  isencao: "Isenção total (100%)",
};

// Aplica um cupom (ou não) em cima de uma taxa de adesão e retorna o
// valor final em reais, nunca negativo. `cupom` pode ser null (sem
// desconto).
export function calcularAdesaoComCupom(taxaAdesao, cupom) {
  const base = Number(taxaAdesao) || 0;
  if (!cupom) return base;

  if (cupom.tipo === "isencao") return 0;
  if (cupom.tipo === "percentual") {
    const percentual = Math.min(100, Math.max(0, Number(cupom.valor) || 0));
    return Math.max(0, Math.round((base * (1 - percentual / 100)) * 100) / 100);
  }
  if (cupom.tipo === "valor_fixo") {
    return Math.max(0, Math.round((base - (Number(cupom.valor) || 0)) * 100) / 100);
  }
  return base;
}

export function cupomEstaValido(cupom) {
  if (!cupom || !cupom.ativo) return false;
  if (cupom.usos_maximo != null && cupom.usos_atual >= cupom.usos_maximo) return false;
  return true;
}
