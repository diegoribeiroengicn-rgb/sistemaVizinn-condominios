// Constantes do módulo Fornecedores.

export const TIPO_LABELS = { empresa: "Empresa", profissional: "Profissional" };

export const STATUS_ORDER = ["ativo", "em_avaliacao", "inativo", "bloqueado"];
export const STATUS_LABELS = {
  ativo: "Ativo",
  inativo: "Inativo",
  em_avaliacao: "Em avaliação",
  bloqueado: "Bloqueado",
};
export const STATUS_STYLES = {
  ativo: "bg-emerald-100 text-emerald-700",
  inativo: "bg-navy-100 text-navy-500",
  em_avaliacao: "bg-amber-100 text-amber-700",
  bloqueado: "bg-coral-100 text-coral-700",
};

export const CATEGORIAS_SUGERIDAS = [
  "Combate a incêndio",
  "SPDA / Para-raios",
  "Extintores",
  "Sistemas de alarme e detecção",
  "Elevadores",
  "Bombas",
  "Elétrica",
  "Hidráulica",
  "Civil/Estrutural",
  "Portões",
  "Segurança",
  "Dedetização / Controle de pragas",
  "Limpeza de piscina",
  "Limpeza de caixa d'água",
  "Limpeza",
  "Jardinagem",
  "Equipamentos",
  "Materiais",
  "TI",
  "Outros",
];

export const CRITERIOS_AVALIACAO = [
  { chave: "nota_qualidade", label: "Qualidade" },
  { chave: "nota_prazo", label: "Cumprimento do prazo" },
  { chave: "nota_custo", label: "Custo" },
  { chave: "nota_atendimento", label: "Atendimento" },
];

// Média simples dos 4 critérios de cada avaliação, depois média simples
// entre avaliações — nada de ranking ponderado ou algoritmo complexo.
export function calcularNotaMedia(avaliacoes) {
  if (!avaliacoes || avaliacoes.length === 0) return null;
  const total = avaliacoes.reduce((soma, a) => {
    const media = (a.nota_qualidade + a.nota_prazo + a.nota_custo + a.nota_atendimento) / 4;
    return soma + media;
  }, 0);
  return total / avaliacoes.length;
}
