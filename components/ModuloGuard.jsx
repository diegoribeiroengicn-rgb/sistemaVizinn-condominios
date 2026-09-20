"use client";

import { useAuth } from "@/hooks/useAuth";

// Bloqueia o conteúdo de uma página de módulo (Avisos, Chamados,
// Ocorrências, Manutenção, Propostas, Portaria, Auditoria...) quando o
// acesso da pessoa não tem permissão de "visualizar" nele — cobre quem
// navega direto pela URL sem ter o link no menu. A segurança de verdade é
// a policy membro_tem_permissao()/membro_tem_modulo() no banco (RLS);
// isto aqui é só a UX de dizer por quê a página está vazia.
export default function ModuloGuard({ modulo, children }) {
  const { temPermissao, loading } = useAuth();

  if (loading) {
    return <p className="text-navy-500">Carregando...</p>;
  }

  if (temPermissao(modulo, "visualizar")) {
    return children;
  }

  return (
    <div className="card text-center text-navy-500">
      Você não tem acesso a este módulo. Fale com o síndico se acha que isso é um engano.
    </div>
  );
}
