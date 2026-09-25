"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CHAVE_SESSAO = "vizinn-valores-financeiros-visiveis";

const ValoresVisiveisContext = createContext(null);

// Estado do "olho" de privacidade visual (seção 27 do projeto) — um
// Context, não um hook solto: um hook com useState próprio dá um
// estado INDEPENDENTE pra cada componente que o chama (o botão e cada
// <ValorPrivado> na mesma tela nunca ficavam sincronizados — era esse
// o bug do olho "não funcionar", cada valor tinha sua própria cópia
// do estado). Com Context, todo mundo dentro do Provider compartilha
// o mesmo estado. Mantido durante a navegação da sessão
// (sessionStorage: some ao fechar a aba, de propósito — não é uma
// preferência permanente). Isso NUNCA altera dado, cálculo ou
// permissão — só a apresentação.
export function ValoresVisiveisProvider({ children }) {
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

  const valor = useMemo(() => ({ visivel, alternar }), [visivel, alternar]);
  return <ValoresVisiveisContext.Provider value={valor}>{children}</ValoresVisiveisContext.Provider>;
}

export function useValoresVisiveis() {
  const contexto = useContext(ValoresVisiveisContext);
  // Fallback só-leitura (sempre visível) pra qualquer tela fora do
  // Provider, sem quebrar em runtime — mas o normal é sempre ter o
  // Provider no layout que envolve as telas financeiras.
  if (!contexto) return { visivel: true, alternar: () => {} };
  return contexto;
}
