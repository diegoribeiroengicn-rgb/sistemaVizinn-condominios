"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

// Redirects to the home page when there is no authenticated user.
// Renders a lightweight loading state while the session is resolved.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <p className="text-navy-500">Carregando...</p>
      </div>
    );
  }

  return children;
}
