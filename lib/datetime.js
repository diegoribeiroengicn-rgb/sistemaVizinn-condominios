// Horário oficial de Brasília (IANA America/Sao_Paulo) — usado em toda
// exibição de data/hora do módulo de Portaria/Pessoas/Auditoria. Os
// timestamps automáticos são gerados no servidor (Postgres `now()`, ver
// supabase/schema.sql) e guardados como instante UTC (timestamptz); aqui só
// convertemos pra exibição/filtro, nunca pra geração do valor em si — assim
// o horário nunca depende do relógio do celular/computador de quem está
// usando o sistema.
export const TIMEZONE_BRASIL = "America/Sao_Paulo";

export function formatarDataHoraBR(valor) {
  if (!valor) return "-";
  return new Date(valor).toLocaleString("pt-BR", { timeZone: TIMEZONE_BRASIL });
}

export function formatarDataBR(valor) {
  if (!valor) return "-";
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: TIMEZONE_BRASIL });
}

// "YYYY-MM-DD" do instante informado, mas já considerando o dia em
// Brasília (não o dia em UTC) — é o que permite comparar um timestamptz
// contra um filtro <input type="date"> sem o erro clássico de virar o dia
// perto da meia-noite por causa do fuso.
export function dataBrasiliaYMD(valor) {
  if (!valor) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BRASIL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(valor));
}

// Valor pronto pra um <input type="datetime-local"> mostrar o instante
// (timestamptz) já convertido pra Brasília, no formato que o próprio input
// exige (sem segundos, sem timezone).
export function paraDatetimeLocalBrasilia(valor) {
  if (!valor) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BRASIL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(valor))
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

// Interpreta o valor de um <input type="datetime-local"> (sem timezone,
// ambíguo) como horário de Brasília e devolve o instante UTC (ISO) correto
// pra gravar — sem aplicar um deslocamento fixo de horas: calcula o offset
// real de Brasília (-03:00, sem horário de verão desde 2019) a partir do
// próprio Intl, então segue correto mesmo se a regra do fuso mudar de novo.
export function datetimeLocalBrasiliaParaISO(valorLocal) {
  if (!valorLocal) return null;
  const [dataParte, horaParte] = valorLocal.split("T");
  const [ano, mes, dia] = dataParte.split("-").map(Number);
  const [hora, minuto] = horaParte.split(":").map(Number);

  // Chute inicial tratando o valor como UTC, depois corrige pelo offset
  // real de Brasília naquele instante (evita hard-code de "-3 horas").
  const chuteUtc = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));
  const offsetMin = obterOffsetMinutos(chuteUtc);
  return new Date(chuteUtc.getTime() - offsetMin * 60000).toISOString();
}

function obterOffsetMinutos(dataUtc) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE_BRASIL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(dataUtc)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    partes.hour === "24" ? 0 : Number(partes.hour),
    Number(partes.minute),
    Number(partes.second)
  );
  return Math.round((comoUtc - dataUtc.getTime()) / 60000);
}
