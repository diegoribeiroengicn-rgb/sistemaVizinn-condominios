"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import LoginForm from "@/components/LoginForm";

// Tela de login dedicada (sem o site de vendas em volta). É pra onde o
// app instalado (PWA) abre direto — ver start_url em app/manifest.js —
// em vez de cair na landing page de marketing.
export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <p className="text-navy-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream-50 px-4 py-8">
      <LoginForm onSuccess={() => router.push("/dashboard")} onSwitchToSignup={() => router.push("/")} />
      <a href="/" className="text-sm font-semibold text-navy-500 hover:underline">
        ← Voltar para o site
      </a>
    </div>
  );
}
