"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import DashboardContent from "@/components/DashboardContent";

const ROLE_HOME = {
  condomino: "/dashboard/avisos",
  porteiro: "/dashboard/ocorrencias",
  conselheiro: "/dashboard/propostas",
};

export default function DashboardPage() {
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role && ROLE_HOME[role]) {
      router.replace(ROLE_HOME[role]);
    }
  }, [role, router]);

  if (role && ROLE_HOME[role]) {
    return <p className="text-navy-500">Redirecionando...</p>;
  }

  return <DashboardContent />;
}
