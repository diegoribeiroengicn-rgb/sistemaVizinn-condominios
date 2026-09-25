"use client";

import { useCallback, useEffect, useState } from "react";

const CHAVE_SESSAO = "vizinn-valores-financeiros-visiveis";

// Estado do "olho" de privacidade visual (seção 27 do projeto) —
// compartilhado entre todos os componentes que mostram valor
// financeiro na mesma aba, mantido durante a navegação da sessão
// (sessionStorage: some ao fechar a aba, de propósito — não é uma
// preferência permanente, é só "não deixa aberto na tela agora").
// Isso NUNCA altera dado, cálculo ou permissão — só a apresentação.
export function useValoresVisiveis() {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    try {
      const salvo = window.sessionStorage.getItem(CHAVE_SESSAO);
      if (salvo !== null) setVisivel(salvo === "1");
    } catch {
      // sem sessionStorage (ex: navegação privada), mantém padrão visível
    }
  }, []);

  const alternar = useCallback(() => {
    setVisivel((atual) => {
      const novo = !atual;
      try {
        window.sessionStorage.setItem(CHAVE_SESSAO, novo ? "1" : "0");
      } catch {
        // ignora — só não persiste entre páginas nessa sessão
      }
      return novo;
    });
  }, []);

  return { visivel, alternar };
}
