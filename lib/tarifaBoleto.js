// Cálculo da tarifa de cobrança por boleto — seção 7 do prompt de
// upgrade. Funções puras, sem I/O, pra poderem ser conferidas direto
// contra os 5 exemplos de validação obrigatórios do prompt (ver
// calcularDiferencaTarifa abaixo).
//
// Composição interna: custo Asaas (estimado, configurável) + margem
// AquiHabitto (configurável) = custo operacional total. Isso NUNCA é
// mostrado ao síndico/condômino (ver README da seção 7.7 do prompt) —
// só o valor final da tarifa, como campo editável com um sugerido.

export function calcularCustoOperacionalTotal({ margemValor, custoAsaasEstimado }) {
  return Number(margemValor || 0) + Number(custoAsaasEstimado || 0);
}

// Diferença entre o que foi cobrado do condômino (tarifa_cobranca,
// pode ser 0) e o custo operacional da operação. Positivo = crédito
// pra administradora, negativo = débito, zero = sem excedente nem
// déficit. Espelha exatamente a tabela de exemplos do prompt:
//
//   cobrado=0,00  custo=2,99  -> -2,99 (débito de R$2,99)
//   cobrado=1,99  custo=2,99  -> -1,00 (débito de R$1,00)
//   cobrado=2,99  custo=2,99  ->  0,00
//   cobrado=3,99  custo=2,99  -> +1,00 (crédito de R$1,00)
//   cobrado=5,00  custo=2,99  -> +2,01 (crédito de R$2,01)
export function calcularDiferencaTarifa(tarifaCobrada, custoOperacionalTotal) {
  // Arredonda em centavos pra evitar erro de ponto flutuante tipo
  // 3.99 - 2.99 = 0.9999999999999998.
  const diferenca = Math.round((Number(tarifaCobrada || 0) - Number(custoOperacionalTotal || 0)) * 100) / 100;
  return {
    diferenca,
    tipo: diferenca > 0 ? "credito" : diferenca < 0 ? "debito" : "neutro",
  };
}
