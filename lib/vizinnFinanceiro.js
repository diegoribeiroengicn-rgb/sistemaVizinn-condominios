// Constantes do financeiro do próprio Vizinn (a empresa, não os
// condomínios clientes) — usado só no painel admin.
export { formatarMoeda } from "@/lib/financeiro";

export const CATEGORIAS_DESPESA_VIZINN = [
  "Hospedagem (Vercel)",
  "Banco de dados (Supabase)",
  "E-mail (Resend)",
  "WhatsApp (Meta)",
  "Pagamentos (Stripe)",
  "Domínio",
  "Marketing",
  "Ferramentas",
  "Outras despesas",
];

export const CATEGORIAS_RECEITA_VIZINN = ["Assinaturas", "Setup/Consultoria", "Outras receitas"];

export const STATUS_LANCAMENTO_ORDER = ["pendente", "pago", "cancelado"];
export const STATUS_LANCAMENTO_LABELS = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};
export const STATUS_LANCAMENTO_STYLES = {
  pendente: "bg-navy-100 text-navy-600",
  pago: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-navy-100 text-navy-400",
};
