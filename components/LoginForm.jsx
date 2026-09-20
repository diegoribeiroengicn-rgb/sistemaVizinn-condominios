"use client";

import { useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginForm({ onSuccess, onSwitchToSignup, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState("");
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false);
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);
  const [erroRecuperar, setErroRecuperar] = useState("");

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

  async function handleRecuperarSenha(e) {
    e.preventDefault();
    setErroRecuperar("");
    if (!isSupabaseConfigured) {
      setErroRecuperar("Supabase não está configurado. Defina as variáveis de ambiente.");
      return;
    }
    setEnviandoRecuperar(true);
    const { error: recuperarError } = await supabase.auth.resetPasswordForEmail(emailRecuperar, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setEnviandoRecuperar(false);
    if (recuperarError) {
      setErroRecuperar(recuperarError.message);
      return;
    }
    setRecuperarEnviado(true);
  }

  if (modoRecuperar) {
    return (
      <div className="card mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-navy-900">Recuperar senha</h2>
          {onClose && (
            <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">
              ✕
            </button>
          )}
        </div>

        {recuperarEnviado ? (
          <div className="space-y-4">
            <p className="text-sm text-navy-600">
              Se houver uma conta com o e-mail <strong>{emailRecuperar}</strong>, enviamos um link
              para você criar uma nova senha. Confira sua caixa de entrada (e o spam).
            </p>
            <button
              onClick={() => {
                setModoRecuperar(false);
                setRecuperarEnviado(false);
                setEmailRecuperar("");
              }}
              className="btn-primary w-full"
            >
              Voltar para o login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRecuperarSenha} className="space-y-4">
            <p className="text-sm text-navy-500">
              Digite o e-mail da sua conta. Vamos te enviar um link para criar uma nova senha.
            </p>
            <div>
              <label className="label-field">E-mail</label>
              <input
                type="email"
                required
                className="input-field"
                value={emailRecuperar}
                onChange={(e) => setEmailRecuperar(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>

            {erroRecuperar && <p className="text-sm text-coral-700">{erroRecuperar}</p>}

            <button type="submit" disabled={enviandoRecuperar} className="btn-primary w-full">
              {enviandoRecuperar ? "Enviando..." : "Enviar link de recuperação"}
            </button>
            <button
              type="button"
              onClick={() => setModoRecuperar(false)}
              className="w-full text-center text-sm font-semibold text-navy-500 hover:underline"
            >
              Voltar para o login
            </button>
          </form>
        )}
      </div>
    );
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
          <button
            type="button"
            onClick={() => {
              setModoRecuperar(true);
              setEmailRecuperar(email);
            }}
            className="mt-1.5 text-sm font-semibold text-navy-500 hover:underline"
          >
            Esqueci minha senha
          </button>
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
