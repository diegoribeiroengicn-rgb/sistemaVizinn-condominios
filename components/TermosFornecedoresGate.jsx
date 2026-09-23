"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

// Bloqueia o módulo Fornecedores até a pessoa aceitar os termos de uso
// (só na primeira vez — depois de aceitar, a linha em
// termos_fornecedores_aceites faz o gate liberar direto). "Não aceito"
// não grava nada e manda de volta pro dashboard; pergunta de novo na
// próxima visita.
const TEXTO_TERMOS = `
Ao avaliar um fornecedor no módulo Fornecedores, sua avaliação pode ser
compartilhada com outros condomínios dentro da Rede de Fornecedores
Vizinn, respeitando sempre estas regras:

• Nunca é compartilhado o CNPJ, o endereço ou qualquer outro dado do seu
  condomínio — apenas o nome do condomínio, e só se você marcar a opção
  "mostrar nome do condomínio" ao enviar a avaliação. Se não marcar,
  ela aparece de forma anônima pra outros condomínios.

• O que aparece pra outros condomínios é: a nota em estrelas e o
  comentário que você escreveu (quando houver).

• Todo comentário passa por um filtro automático de linguagem ofensiva
  antes de ficar visível — palavras ofensivas são substituídas por
  asteriscos, igual em sites de reclamação conhecidos.

• Você pode escolher, avaliação por avaliação, se quer que o nome do
  seu condomínio apareça junto da nota ou não.

Ao clicar em "Aceito", você concorda com essas regras de uso do módulo
Fornecedores.
`.trim();

export default function TermosFornecedoresGate({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState("carregando"); // carregando | pendente | aceito
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let ativo = true;
    supabase
      .from("termos_fornecedores_aceites")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setStatus(data ? "aceito" : "pendente");
      });
    return () => {
      ativo = false;
    };
  }, [user?.id]);

  async function aceitar() {
    setSalvando(true);
    setErro("");
    const { error } = await supabase.from("termos_fornecedores_aceites").insert({ user_id: user.id });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setStatus("aceito");
  }

  if (status === "carregando") {
    return <p className="text-navy-500">Carregando...</p>;
  }

  if (status === "aceito") {
    return children;
  }

  return (
    <div className="card mx-auto max-w-2xl">
      <h2 className="font-display text-xl font-bold text-navy-900">Termos de uso — Módulo Fornecedores</h2>
      <p className="mt-4 whitespace-pre-line text-sm text-navy-600">{TEXTO_TERMOS}</p>

      {erro && <p className="mt-4 text-sm text-coral-700">{erro}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={aceitar} disabled={salvando} className="btn-primary">
          {salvando ? "Salvando..." : "Aceito"}
        </button>
        <button
          type="button"
          onClick={() => window.location.assign("/dashboard")}
          className="btn-secondary"
        >
          Não aceito
        </button>
      </div>
    </div>
  );
}
