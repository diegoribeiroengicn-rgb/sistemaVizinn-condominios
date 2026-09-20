"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

// Client-side redirect for the /admin section. This is a UX convenience
// only — the real enforcement is server-side (lib/adminAuth.js) on every
// /api/admin/* request, so a non-admin can never read tenant data even if
// this check were bypassed.
export default function AdminGuard({ children }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(user ? "/dashboard" : "/");
    }
  }, [loading, user, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <p className="text-navy-500">Carregando...</p>
      </div>
    );
  }

  return children;
}
