// Constantes do módulo Financeiro (Contas a Pagar / Contas a Receber /
// Balanço) — categorias sugeridas, status e o indicador visual de
// vencimento (mesmo padrão 🟢🟡🔴 já usado em Chamados).

export const CATEGORIAS_RECEITA = [
  "Cotas condominiais",
  "Multas",
  "Juros",
  "Aluguel de áreas",
  "Eventos",
  "Outras receitas",
];

export const CATEGORIAS_DESPESA = [
  "Água",
  "Energia",
  "Funcionários",
  "Limpeza",
  "Segurança",
  "Manutenção",
  "Elevadores",
  "Combate a incêndio",
  "SPDA",
  "Jardinagem",
  "Piscina",
  "Dedetização",
  "Materiais",
  "Obras",
  "Administrativas",
  "Outras despesas",
];

export const FORMAS_PAGAMENTO = ["Boleto", "PIX", "Transferência", "Cartão", "Dinheiro", "Débito automático"];

export const STATUS_PAGAR_ORDER = ["pendente", "a_vencer", "vencida", "pago", "cancelada"];
export const STATUS_PAGAR_LABELS = {
  pendente: "Pendente",
  a_vencer: "A vencer",
  vencida: "Vencida",
  pago: "Pago",
  cancelada: "Cancelada",
};
export const STATUS_PAGAR_STYLES = {
  pendente: "bg-navy-100 text-navy-600",
  a_vencer: "bg-amber-100 text-amber-700",
  vencida: "bg-coral-100 text-coral-700",
  pago: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-navy-100 text-navy-400",
};
export const STATUS_PAGAR_FINAIS = ["pago", "cancelada"];

export const STATUS_RECEBER_ORDER = ["pendente", "a_vencer", "vencida", "recebida", "cancelada"];
export const STATUS_RECEBER_LABELS = {
  pendente: "Pendente",
  a_vencer: "A vencer",
  vencida: "Vencida",
  recebida: "Recebida",
  cancelada: "Cancelada",
};
export const STATUS_RECEBER_STYLES = {
  pendente: "bg-navy-100 text-navy-600",
  a_vencer: "bg-amber-100 text-amber-700",
  vencida: "bg-coral-100 text-coral-700",
  recebida: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-navy-100 text-navy-400",
};
export const STATUS_RECEBER_FINAIS = ["recebida", "cancelada"];

export const VENCIMENTO_BADGE_STYLES = {
  verde: "bg-emerald-100 text-emerald-700",
  amarelo: "bg-amber-100 text-amber-700",
  vermelho: "bg-coral-100 text-coral-700",
};

// 🟢 dentro do prazo · 🟡 vence em até 5 dias · 🔴 vencida. Contas já
// pagas/recebidas/canceladas não têm indicador.
export function calcularStatusVencimento(dataVencimento, status, statusFinais) {
  if (!dataVencimento || statusFinais.includes(status)) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(`${dataVencimento}T00:00:00`);
  const diasRestantes = Math.round((vencimento - hoje) / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) return { nivel: "vermelho", emoji: "🔴", label: "Vencida" };
  if (diasRestantes <= 5) return { nivel: "amarelo", emoji: "🟡", label: "Vence em breve" };
  return { nivel: "verde", emoji: "🟢", label: "Em dia" };
}

export function formatarMoeda(valor) {
  if (valor == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}
