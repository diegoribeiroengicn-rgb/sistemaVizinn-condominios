// Regras de precificação do Pro+ Multicondomínios — equivalência por
// porte de condomínio e mensalidade progressiva. A tabela de faixas em
// si é editável pelo admin (multicondominios_faixas); essas são só as
// funções de cálculo, puras e sem I/O, pra poderem ser testadas e
// reaproveitadas tanto no dashboard do síndico quanto na página de
// vendas.

// 1 equivalente até 30 unidades, 2 de 31 a 100, 3 de 101 a 500. Acima
// de 500 é "regra especial" (seção 11.1 do prompt) — aqui, mais um
// equivalente a cada 500 unidades adicionais, como ponto de partida
// configurável (não é uma tabela no banco porque a seção 14 só pede
// isso pra tabela de PREÇOS, não pra tabela de equivalência).
export function calcularEquivalencia(unidades) {
  const n = Number(unidades) || 0;
  if (n <= 30) return 1;
  if (n <= 100) return 2;
  if (n <= 500) return 3;
  return 3 + Math.ceil((n - 500) / 500);
}

// Soma a equivalência de todos os condomínios do dono. Aceita tanto
// `unidades_limite` (o que o plano individual do condomínio permite)
// quanto `unidades_ativas` (quantidade real hoje) — por padrão usa
// unidades_ativas por ser o porte real, com fallback pro limite.
export function calcularEquivalenciaTotal(condominios) {
  return (condominios || []).reduce(
    (soma, c) => soma + calcularEquivalencia(c.unidades_ativas || c.unidades_limite || 0),
    0
  );
}

// Acha a faixa (já carregada do banco, ordenada ou não) que cobre uma
// equivalência total — null quando não há faixa nenhuma cadastrada ou
// a equivalência é menor que a faixa mínima configurada.
export function encontrarFaixa(equivalenciaTotal, faixas) {
  return (
    (faixas || [])
      .filter((f) => f.ativo !== false)
      .find(
        (f) =>
          equivalenciaTotal >= f.equivalentes_min &&
          (f.equivalentes_max == null || equivalenciaTotal <= f.equivalentes_max)
      ) || null
  );
}

export function calcularMensalidade(equivalenciaTotal, faixas) {
  const faixa = encontrarFaixa(equivalenciaTotal, faixas);
  return faixa ? Number(faixa.mensalidade) : null;
}

// Dias restantes de trial (>= 0) a partir de contas_sindico.pro_plus_trial_fim
// (string "YYYY-MM-DD" ou null). Negativo nunca é retornado — já
// encerrado vira 0.
export function diasRestantesTrial(proPlusTrialFim) {
  if (!proPlusTrialFim) return null;
  const fim = new Date(`${proPlusTrialFim}T23:59:59`);
  const hoje = new Date();
  const dias = Math.ceil((fim - hoje) / 86400000);
  return Math.max(0, dias);
}
