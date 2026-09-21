// Propostas comerciais — não é mais um módulo/página independente (ver
// nota em lib/permissoes.js). Cada proposta pertence a um registro de
// Manutenção ou de Obras e Melhorias (manutencao_origem_id ou
// obra_origem_id), nunca aos dois ao mesmo tempo.

export const STATUS_ORDER = ["recebida", "em_analise", "aprovada", "rejeitada"];
export const STATUS_LABELS = {
  recebida: "Recebida",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};
export const STATUS_STYLES = {
  recebida: "bg-navy-100 text-navy-600",
  em_analise: "bg-amber-100 text-amber-700",
  aprovada: "bg-emerald-100 text-emerald-700",
  rejeitada: "bg-coral-100 text-coral-700",
};
export const STATUS_DECISAO = ["aprovada", "rejeitada"];
