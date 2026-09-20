"use client";

// Contexto compartilhado: qualquer formulário da tela avisa aqui quando
// tem algo digitado e ainda não salvo (ver hooks/useAvisoSaidaSemSalvar).
// A sidebar consulta esse valor antes de navegar pra outro módulo, pra
// perguntar "sair sem salvar?" em vez de simplesmente trocar de página.
import { createContext, useContext, useRef, useState } from "react";

const FormDirtyContext = createContext({ dirty: false, setDirty: () => {} });

export function FormDirtyProvider({ children }) {
  const [dirty, setDirtyState] = useState(false);
  // Vários formulários podem existir na mesma página (Financeiro tem
  // dois); só fica "limpo" quando todos ficarem limpos.
  const sujos = useRef(new Set());

  function setDirty(id, valor) {
    if (valor) sujos.current.add(id);
    else sujos.current.delete(id);
    setDirtyState(sujos.current.size > 0);
  }

  return <FormDirtyContext.Provider value={{ dirty, setDirty }}>{children}</FormDirtyContext.Provider>;
}

export function useFormDirty() {
  return useContext(FormDirtyContext);
}
