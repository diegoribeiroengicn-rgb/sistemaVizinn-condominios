"use client";

import { useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginForm({ onSuccess, onSwitchToSignup, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
      setError("Supabase não está configurado. Defina as variáveis de ambiente.");
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : signInError.message
      );
      return;
    }

    onSuccess?.();
  }

  return (
    <div className="card mx-auto w-full max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-navy-900">Entrar</h2>
        {onClose && (
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">
            ✕
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-field">E-mail</label>
          <input
            type="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>
        <div>
          <label className="label-field">Senha</label>
          <input
            type="password"
            required
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-coral-700">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-500">
        Ainda não tem conta?{" "}
        <button onClick={onSwitchToSignup} className="font-semibold text-coral hover:underline">
          Começar agora
        </button>
      </p>
    </div>
  );
}
