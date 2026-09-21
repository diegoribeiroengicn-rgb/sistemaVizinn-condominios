// Constantes do módulo Obras e Melhorias — registro e acompanhamento de
// obras, reformas e intervenções no condomínio. Separado de Manutenção
// (que é sobre manutenção recorrente/corretiva de rotina): aqui o foco é
// projeto com orçamento e prazo próprios.

export const STATUS_ORDER = [
  "planejada",
  "em_orcamento",
  "aprovada",
  "em_andamento",
  "pausada",
  "concluida",
  "cancelada",
];

export const STATUS_LABELS = {
  planejada: "Planejada",
  em_orcamento: "Em orçamento",
  aprovada: "Aprovada",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const STATUS_STYLES = {
  planejada: "bg-navy-100 text-navy-600",
  em_orcamento: "bg-amber-100 text-amber-700",
  aprovada: "bg-sky-100 text-sky-700",
  em_andamento: "bg-blue-100 text-blue-700",
  pausada: "bg-orange-100 text-orange-700",
  concluida: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-navy-100 text-navy-400",
};
