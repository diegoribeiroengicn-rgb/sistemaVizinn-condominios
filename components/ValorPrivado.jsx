"use client";

import { useValoresVisiveis } from "@/hooks/useValoresVisiveis";
import { IconOlhoAberto, IconOlhoFechado } from "@/components/icons";

// Mostra um valor financeiro já formatado (ex: "R$ 15.800,00") ou uma
// máscara ("R$ •••••••") conforme o estado global de privacidade
// visual (seção 27) — nunca mexe no valor real, só na apresentação.
export default function ValorPrivado({ valor, className = "" }) {
  const { visivel } = useValoresVisiveis();
  if (visivel) return <span className={className}>{valor}</span>;
  const mascarado = String(valor).replace(/[0-9]/g, "•");
  return (
    <span className={className} aria-label="Valor oculto">
      {mascarado}
    </span>
  );
}

// Botão de alternar (olho aberto/fechado) — coloca perto do título da
// seção financeira. Um só clique alterna todos os <ValorPrivado> da
// aba (estado compartilhado via sessionStorage).
export function BotaoAlternarValores({ className = "" }) {
  const { visivel, alternar } = useValoresVisiveis();
  return (
    <button
      type="button"
      onClick={alternar}
      title={visivel ? "Ocultar valores" : "Mostrar valores"}
      aria-label={visivel ? "Ocultar valores financeiros" : "Mostrar valores financeiros"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-navy-500 transition hover:bg-navy-50 hover:text-navy-800 ${className}`}
    >
      {visivel ? <IconOlhoAberto className="h-4 w-4" /> : <IconOlhoFechado className="h-4 w-4" />}
      <span className="hidden sm:inline">{visivel ? "Ocultar valores" : "Mostrar valores"}</span>
    </button>
  );
}
