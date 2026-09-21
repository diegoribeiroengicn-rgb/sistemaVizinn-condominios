"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import LandingHero from "@/components/LandingHero";
import Features from "@/components/Features";
import AcademiaDestaque from "@/components/AcademiaDestaque";
import EcossistemaFornecedores from "@/components/EcossistemaFornecedores";
import Pricing from "@/components/Pricing";
import FinalCta from "@/components/FinalCta";
import SignupForm from "@/components/SignupForm";
import LoginForm from "@/components/LoginForm";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authView, setAuthView] = useState(null); // null | "login" | "signup"
  const [selectedPlan, setSelectedPlan] = useState("growth");

  // Logged-in users skip the landing page entirely.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  function openSignup(planId = "growth") {
    setSelectedPlan(planId);
    setAuthView("signup");
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <p className="text-navy-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <Header onStart={() => openSignup("growth")} onLogin={() => setAuthView("login")} />
      <LandingHero onStart={() => openSignup("growth")} />
      <Features />
      <AcademiaDestaque onStart={() => openSignup("growth")} />
      <EcossistemaFornecedores onStart={() => openSignup("growth")} />
      <Pricing onSelectPlan={openSignup} />
      <FinalCta onStart={() => openSignup("growth")} />

      <footer className="border-t border-navy-100 py-8 text-center text-sm text-navy-400">
        © {new Date().getFullYear()} Vizinn — Condomínio Inteligente
      </footer>

      {authView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto">
            {authView === "signup" ? (
              <SignupForm initialPlan={selectedPlan} onClose={() => setAuthView(null)} />
            ) : (
              <LoginForm
                onSuccess={() => router.push("/dashboard")}
                onSwitchToSignup={() => openSignup("growth")}
                onClose={() => setAuthView(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
