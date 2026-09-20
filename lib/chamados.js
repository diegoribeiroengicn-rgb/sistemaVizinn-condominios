// Constantes do módulo Chamados: tipos, status, prioridade e o cálculo de
// prazo (🟢🟡🔴) usado tanto na criação quanto na listagem.

export const TIPO_LABELS = {
  condominio: "Condomínio",
  interno: "Interno",
};

// Ordem = fluxo natural do chamado. "concluido"/"cancelado" são estados
// finais (não entram mais no cálculo de prazo).
export const STATUS_ORDER = [
  "aberto",
  "em_analise",
  "em_atendimento",
  "aguardando_informacao",
  "aguardando_morador",
  "aguardando_prestador",
  "aguardando_aprovacao",
  "concluido",
  "cancelado",
];

export const STATUS_LABELS = {
  aberto: "Aberto",
  em_analise: "Em análise",
  em_atendimento: "Em atendimento",
  aguardando_informacao: "Aguardando informação",
  aguardando_morador: "Aguardando morador",
  aguardando_prestador: "Aguardando prestador",
  aguardando_aprovacao: "Aguardando aprovação",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const STATUS_STYLES = {
  aberto: "bg-coral-100 text-coral-700",
  em_analise: "bg-amber-100 text-amber-700",
  em_atendimento: "bg-amber-100 text-amber-700",
  aguardando_informacao: "bg-navy-100 text-navy-700",
  aguardando_morador: "bg-navy-100 text-navy-700",
  aguardando_prestador: "bg-navy-100 text-navy-700",
  aguardando_aprovacao: "bg-navy-100 text-navy-700",
  concluido: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-navy-100 text-navy-500",
};

export const STATUS_FINAIS = ["concluido", "cancelado"];

export const PRIORIDADE_ORDER = ["baixa", "normal", "alta", "urgente"];

export const PRIORIDADE_LABELS = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_STYLES = {
  baixa: "bg-navy-50 text-navy-500",
  normal: "bg-navy-100 text-navy-600",
  alta: "bg-amber-100 text-amber-700",
  urgente: "bg-coral-100 text-coral-700",
};

// Sugestões de categoria (não é uma lista fechada — o campo é texto
// livre) e um prazo padrão em dias pra cada uma, só pra pré-preencher a
// data prevista quando a categoria bater. O síndico sempre pode mudar a
// data na hora de abrir o chamado.
export const CATEGORIA_SUGESTOES = [
  "Hidráulica",
  "Elétrica",
  "Limpeza",
  "Administrativo",
  "Portão/Acesso",
  "Elevador",
  "Jardinagem",
  "Segurança",
  "Outro",
];

const PRAZO_SUGERIDO_DIAS = {
  hidráulica: 1,
  elétrica: 2,
  limpeza: 1,
  administrativo: 3,
  "portão/acesso": 2,
  elevador: 2,
  jardinagem: 3,
  segurança: 1,
};

export function sugerirDataPrevista(categoria) {
  const dias = PRAZO_SUGERIDO_DIAS[(categoria || "").trim().toLowerCase()];
  if (!dias) return "";
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

// 🟢 dentro do prazo · 🟡 prazo próximo (até 1 dia) · 🔴 vencido/atrasado.
// Chamados já concluídos/cancelados não têm indicador (o prazo deixou de
// importar).
export function calcularStatusPrazo(dataPrevista, status) {
  if (!dataPrevista || STATUS_FINAIS.includes(status)) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prevista = new Date(`${dataPrevista}T00:00:00`);
  const diasRestantes = Math.round((prevista - hoje) / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) {
    return { nivel: "vermelho", emoji: "🔴", label: "Atrasado", atrasado: true };
  }
  if (diasRestantes <= 1) {
    return { nivel: "amarelo", emoji: "🟡", label: "Prazo próximo", atrasado: false };
  }
  return { nivel: "verde", emoji: "🟢", label: "Dentro do prazo", atrasado: false };
}

export const PRAZO_BADGE_STYLES = {
  verde: "bg-emerald-100 text-emerald-700",
  amarelo: "bg-amber-100 text-amber-700",
  vermelho: "bg-coral-100 text-coral-700",
};
