"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import DashboardContent from "@/components/DashboardContent";
import { MODULO_ROUTES } from "@/lib/permissoes";

export default function DashboardPage() {
  const { role, modulosVisiveis, loading } = useAuth();
  const router = useRouter();

  const isMember = Boolean(role) && role !== "sindico";
  // "visao_geral" agora é um módulo concedível como qualquer outro — se a
  // pessoa tem, ela fica aqui mesmo. Se não tem, manda pro primeiro
  // módulo que ela enxerga (em ordem fixa).
  const temVisaoGeral = isMember && modulosVisiveis.includes("visao_geral");
  const primeiroModulo = isMember ? modulosVisiveis.find((m) => m !== "visao_geral") : null;
  const home = isMember && !temVisaoGeral ? MODULO_ROUTES[primeiroModulo] : null;

  useEffect(() => {
    if (home) router.replace(home);
  }, [home, router]);

  if (loading) {
    return <p className="text-navy-500">Carregando...</p>;
  }

  if (home) {
    return <p className="text-navy-500">Redirecionando...</p>;
  }

  if (isMember && !temVisaoGeral && !primeiroModulo) {
    return (
      <div className="card text-center text-navy-500">
        Seu acesso ainda não tem nenhum módulo liberado. Fale com o síndico.
      </div>
    );
  }

  return <DashboardContent />;
}
