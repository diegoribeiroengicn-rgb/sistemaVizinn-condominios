"use client";

// Avisa antes de sair de uma tela com algo preenchido e não salvo — tanto
// fechando/atualizando a aba (beforeunload) quanto navegando para outro
// módulo pela sidebar (via FormDirtyContext, que a sidebar consulta).
// Uso: cada página com um formulário (o padrão `form`/`emptyForm` já
// usado em quase toda tela) chama isto com os dois; o resto é automático.
import { useEffect, useId } from "react";
import { useFormDirty } from "@/lib/formDirtyContext";

export function useAvisoSaidaSemSalvar(form, formVazio) {
  const id = useId();
  const { setDirty } = useFormDirty();
  const sujo = JSON.stringify(form) !== JSON.stringify(formVazio);

  useEffect(() => {
    setDirty(id, sujo);
    return () => setDirty(id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sujo]);

  useEffect(() => {
    function handler(e) {
      if (!sujo) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sujo]);

  return sujo;
}
