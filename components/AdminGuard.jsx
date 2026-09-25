"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAcesso } from "@/hooks/useAdminAcesso";

// Client-side redirect for the /admin section. This is a UX convenience
// only — the real enforcement is server-side (lib/adminAuth.js) on every
// /api/admin/* request, so a non-admin can never read tenant data even if
// this check were bypassed. "Admin" aqui cobre tanto o dono da plataforma
// quanto um funcionário com acesso a pelo menos um módulo (useAdminAcesso).
export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  const { carregando, autorizado } = useAdminAcesso();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !carregando && (!user || !autorizado)) {
      router.replace(user ? "/dashboard" : "/");
    }
  }, [loading, carregando, user, autorizado, router]);

  if (loading || carregando || !user || !autorizado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <p className="text-navy-500">Carregando...</p>
      </div>
    );
  }

  return children;
}
