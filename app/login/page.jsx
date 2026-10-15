"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import LoginForm from "@/components/LoginForm";
import SignupForm from "@/components/SignupForm";

// Tela de login/cadastro dedicada (sem o site de vendas em volta). É
// pra onde o app instalado (PWA) abre direto — ver start_url em
// app/manifest.js — em vez de cair na landing page de marketing. As
// duas abas (Entrar / Começar) ficam na mesma tela pra quem ainda não
// tem conta não precisar navegar pro site pra se cadastrar.
export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState("entrar"); // "entrar" | "comecar"

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
      <div className="flex gap-2 rounded-full bg-navy-100 p-1">
        <button
          onClick={() => setAba("entrar")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
            aba === "entrar" ? "bg-white text-navy-900 shadow-soft" : "text-navy-500"
          }`}
        >
          Entrar
        </button>
        <button
          onClick={() => setAba("comecar")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
            aba === "comecar" ? "bg-white text-navy-900 shadow-soft" : "text-navy-500"
          }`}
        >
          Começar
        </button>
      </div>

      {aba === "entrar" ? (
        <LoginForm onSuccess={() => router.push("/dashboard")} onSwitchToSignup={() => setAba("comecar")} />
      ) : (
        <SignupForm />
      )}

      <a href="/" className="text-sm font-semibold text-navy-500 hover:underline">
        ← Voltar para o site
      </a>
    </div>
  );
}
