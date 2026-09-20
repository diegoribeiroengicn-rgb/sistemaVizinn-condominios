// Filtro global de período — usado na Visão Geral, nos gráficos e, mais
// pra frente, nos relatórios. Cada opção calcula um intervalo [inicio, fim]
// (ambos à meia-noite, fim inclusivo) a partir de hoje.

export const PERIODO_OPTIONS = [
  { id: "hoje", label: "Hoje" },
  { id: "7dias", label: "Últimos 7 dias" },
  { id: "30dias", label: "Últimos 30 dias" },
  { id: "mes_atual", label: "Mês atual" },
  { id: "mes_anterior", label: "Mês anterior" },
  { id: "trimestre", label: "Trimestre" },
  { id: "semestre", label: "Semestre" },
  { id: "ano", label: "Ano" },
  { id: "personalizado", label: "Período personalizado" },
];

function inicioDoDia(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fimDoDia(data) {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Retorna { inicio, fim } (objetos Date) ou null quando o período é
// "personalizado" e as datas ainda não foram preenchidas.
export function calcularIntervaloPeriodo(periodoId, personalizado) {
  const hoje = inicioDoDia(new Date());

  switch (periodoId) {
    case "hoje":
      return { inicio: hoje, fim: fimDoDia(hoje) };
    case "7dias": {
      const inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 6);
      return { inicio, fim: fimDoDia(hoje) };
    }
    case "30dias": {
      const inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 29);
      return { inicio, fim: fimDoDia(hoje) };
    }
    case "mes_atual": {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return { inicio, fim: fimDoDia(fim) };
    }
    case "mes_anterior": {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { inicio, fim: fimDoDia(fim) };
    }
    case "trimestre": {
      const inicio = new Date(hoje);
      inicio.setMonth(inicio.getMonth() - 3);
      return { inicio, fim: fimDoDia(hoje) };
    }
    case "semestre": {
      const inicio = new Date(hoje);
      inicio.setMonth(inicio.getMonth() - 6);
      return { inicio, fim: fimDoDia(hoje) };
    }
    case "ano": {
      const inicio = new Date(hoje.getFullYear(), 0, 1);
      const fim = new Date(hoje.getFullYear(), 11, 31);
      return { inicio, fim: fimDoDia(fim) };
    }
    case "personalizado": {
      if (!personalizado?.inicio || !personalizado?.fim) return null;
      return { inicio: inicioDoDia(personalizado.inicio), fim: fimDoDia(personalizado.fim) };
    }
    default:
      return null;
  }
}

// true quando `valor` (string de data/timestamp) cai dentro do intervalo.
// Sem intervalo (período personalizado incompleto) ou sem valor, não filtra.
export function dentroDoIntervalo(valor, intervalo) {
  if (!intervalo) return true;
  if (!valor) return false;
  const data = new Date(valor);
  return data >= intervalo.inicio && data <= intervalo.fim;
}

export function formatarIntervalo(intervalo) {
  if (!intervalo) return "";
  const fmt = (d) => d.toLocaleDateString("pt-BR");
  return `${fmt(intervalo.inicio)} a ${fmt(intervalo.fim)}`;
}
