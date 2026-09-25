"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function VendedorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState("");
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false);
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!isSupabaseConfigured) {
      setError("Supabase não está configurado.");
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (signInError) {
      setLoading(false);
      setError(signInError.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : signInError.message);
      return;
    }
    router.push("/vendedor/dashboard");
  }

  async function handleRecuperar(e) {
    e.preventDefault();
    setEnviandoRecuperar(true);
    const { error: recError } = await supabase.auth.resetPasswordForEmail(emailRecuperar, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setEnviandoRecuperar(false);
    if (recError) {
      setError(recError.message);
      return;
    }
    setRecuperarEnviado(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-navy-900">Área do vendedor</h1>
        <p className="mt-1 text-sm text-navy-500">Acesse pra ver suas vendas, comissões e seu link de indicação.</p>

        {modoRecuperar ? (
          recuperarEnviado ? (
            <p className="mt-6 text-sm text-emerald-700">
              Se esse e-mail tiver um acesso de vendedor, enviamos um link pra redefinir a senha.
            </p>
          ) : (
            <form onSubmit={handleRecuperar} className="mt-6 space-y-3">
              <div>
                <label className="label-field">E-mail</label>
                <input
                  type="email"
                  required
                  className="input-field"
                  value={emailRecuperar}
                  onChange={(e) => setEmailRecuperar(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-coral-700">{error}</p>}
              <button type="submit" disabled={enviandoRecuperar} className="btn-primary w-full">
                {enviandoRecuperar ? "Enviando..." : "Enviar link de recuperação"}
              </button>
              <button type="button" onClick={() => setModoRecuperar(false)} className="text-sm font-semibold text-navy-500 hover:underline">
                Voltar ao login
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div>
              <label className="label-field">E-mail</label>
              <input type="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Senha</label>
              <input type="password" required className="input-field" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            {error && <p className="text-sm text-coral-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button type="button" onClick={() => setModoRecuperar(true)} className="text-sm font-semibold text-navy-500 hover:underline">
              Esqueci minha senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
