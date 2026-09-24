// Constantes do Destaque Comercial de Fornecedores (painel admin) —
// informação exclusivamente administrativa/comercial, nunca exposta a
// fornecedor, condomínio ou morador. Ver supabase/schema.sql
// (fornecedores_destaque_comercial) e buscar_fornecedores_rede().

export const SITUACAO_PAGAMENTO_LABELS = {
  pendente: "Pendente",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

export const SITUACAO_PAGAMENTO_STYLES = {
  pendente: "bg-amber-100 text-amber-700",
  pago: "bg-emerald-100 text-emerald-700",
  vencido: "bg-coral-100 text-coral-700",
  cancelado: "bg-navy-100 text-navy-500",
};

// Mesma regra usada em buscar_fornecedores_rede() no banco — só pra
// exibir ao admin se o destaque está "valendo" de verdade agora
// (pagamento em dia + ativo + dentro da vigência), sem alterar nada.
export function destaqueEstaVigente(destaque) {
  if (!destaque) return false;
  if (!destaque.destaque_ativo) return false;
  if (destaque.situacao_pagamento !== "pago") return false;
  if (!destaque.nivel || destaque.nivel < 1) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  if (destaque.data_inicio && destaque.data_inicio > hoje) return false;
  if (destaque.data_fim && destaque.data_fim < hoje) return false;
  return true;
}
