// Constantes do módulo Colaboradores — pessoas que trabalham no
// condomínio, separado de `membros` (quem tem login no Vizinn). Um
// colaborador pode existir sem login algum.

export const FUNCAO_SUGESTOES = [
  "Síndico",
  "Subsíndico",
  "Administrador",
  "Zelador",
  "Subzelador",
  "Porteiro",
  "Auxiliar de serviços gerais",
  "Equipe de limpeza",
  "Manutenção",
  "Segurança",
  "Outros",
];

export const STATUS_ORDER = ["ativo", "ferias", "afastado", "inativo"];
export const STATUS_LABELS = {
  ativo: "Ativo",
  ferias: "Férias",
  afastado: "Afastado",
  inativo: "Inativo",
};
export const STATUS_STYLES = {
  ativo: "bg-emerald-100 text-emerald-700",
  ferias: "bg-amber-100 text-amber-700",
  afastado: "bg-navy-100 text-navy-600",
  inativo: "bg-navy-100 text-navy-400",
};

// Formata telefone/whatsapp padronizado (DDI + DDD + número) só pra
// exibição — os campos ficam separados no banco pra facilitar uma futura
// integração de automação por WhatsApp.
export function formatarWhatsapp(colaborador) {
  const { whatsapp_ddi, whatsapp_ddd, whatsapp_numero } = colaborador || {};
  if (!whatsapp_numero) return null;
  const ddi = whatsapp_ddi || "55";
  return [ddi && `+${ddi}`, whatsapp_ddd && `(${whatsapp_ddd})`, whatsapp_numero].filter(Boolean).join(" ");
}
