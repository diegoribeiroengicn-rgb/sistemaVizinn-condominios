"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import DashboardContent from "@/components/DashboardContent";
import { ALL_MODULOS, MODULO_ROUTES } from "@/lib/modulos";

export default function DashboardPage() {
  const { role, modulos, loading } = useAuth();
  const router = useRouter();

  // Delimited members (any papel) don't have a "visão geral" — send them
  // straight to the first módulo their acesso has, in a fixed order.
  const firstModuloRoute = ALL_MODULOS.find((m) => modulos.includes(m));
  const home = role && role !== "sindico" ? MODULO_ROUTES[firstModuloRoute] : null;

  useEffect(() => {
    if (home) router.replace(home);
  }, [home, router]);

  if (loading) {
    return <p className="text-navy-500">Carregando...</p>;
  }

  if (home) {
    return <p className="text-navy-500">Redirecionando...</p>;
  }

  if (role && role !== "sindico" && !firstModuloRoute) {
    return (
      <div className="card text-center text-navy-500">
        Seu acesso ainda não tem nenhum módulo liberado. Fale com o síndico.
      </div>
    );
  }

  return <DashboardContent />;
}
