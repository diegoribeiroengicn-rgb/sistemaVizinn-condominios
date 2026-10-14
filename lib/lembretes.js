// Constantes e helpers do módulo Lembretes — painel central do síndico
// (lembretes manuais + espelho por referência dos alertas de Manutenção).
// Ver supabase/schema.sql (tabelas lembretes/lembretes_estagios) e
// app/api/lembretes, app/api/cron/lembretes.

export const PRIORIDADE_LABELS = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_OPTIONS = ["baixa", "normal", "alta", "urgente"];

export const PRIORIDADE_BADGE_STYLES = {
  baixa: "bg-navy-100 text-navy-600",
  normal: "bg-sky-100 text-sky-700",
  alta: "bg-amber-100 text-amber-700",
  urgente: "bg-coral-100 text-coral-700",
};

export const STATUS_LABELS = {
  pendente: "Pendente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const ORIGEM_LABELS = {
  manual: "Manual",
  manutencao: "Manutenção",
  financeiro: "Financeiro",
};

export const RECORRENCIA_LABELS = {
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
  anual: "Anual",
};

// Presets comuns de antecedência, em dias — só sugestão no formulário,
// o síndico pode digitar qualquer combinação.
export const ESTAGIOS_SUGERIDOS = [
  { dias: 60, label: "2 meses antes" },
  { dias: 30, label: "1 mês antes" },
  { dias: 15, label: "15 dias antes" },
  { dias: 0, label: "No dia" },
];

// Mesmo critério visual de calcularStatusPrazo (Chamados) e
// calcularStatusVencimento (Financeiro) — mantém os três módulos com a
// mesma linguagem de cor/urgência.
export function calcularStatusLembrete(dataAlerta, status) {
  if (!dataAlerta || status !== "pendente") return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alerta = new Date(`${dataAlerta}T00:00:00`);
  const diasRestantes = Math.round((alerta - hoje) / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) return { nivel: "vermelho", emoji: "🔴", label: "Atrasado", atrasado: true };
  if (diasRestantes <= 2) return { nivel: "amarelo", emoji: "🟡", label: "Vence em breve", atrasado: false };
  return { nivel: "verde", emoji: "🟢", label: "Em dia", atrasado: false };
}

// A partir de uma data de referência (ex.: manutencoes.proxima_data) e um
// array de dias de antecedência, devolve as datas de disparo de cada
// estágio ("2 meses antes" = referencia - 60 dias etc). Usado tanto no
// formulário manual (data_alerta como referência) quanto no cron que
// materializa os lembretes de Manutenção.
export function calcularEstagios(dataReferencia, diasAntecedenciaArray) {
  if (!dataReferencia || !Array.isArray(diasAntecedenciaArray)) return [];
  const referencia = new Date(`${dataReferencia}T00:00:00`);
  const vistos = new Set();
  return diasAntecedenciaArray
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d >= 0 && !vistos.has(d) && vistos.add(d))
    .sort((a, b) => b - a)
    .map((dias) => {
      const disparo = new Date(referencia);
      disparo.setDate(disparo.getDate() - dias);
      return { dias_antecedencia: dias, data_disparo: disparo.toISOString().slice(0, 10) };
    });
}
