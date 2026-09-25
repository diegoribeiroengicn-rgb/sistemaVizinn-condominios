"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Página aberta pelo link de recuperação enviado por e-mail
// (supabase.auth.resetPasswordForEmail). O próprio cliente Supabase já
// detecta o token na URL e cria uma sessão temporária (detectSessionInUrl:
// true em lib/supabase.js) — aqui só falta pedir a nova senha e salvar.
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [temSessao, setTemSessao] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPronto(true);
      return;
    }
    // Dá um instante pro supabase-js processar o token da URL antes de
    // checar a sessão.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setTemSessao(true);
      }
      setPronto(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setTemSessao(true);
      setPronto(true);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas não são iguais.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }
    setSucesso(true);
    // Vendedor tem um painel separado do síndico/morador — manda pro
    // lugar certo conforme o metadata gravado na criação do usuário
    // (ver /api/admin/vendedores/[id]/criar-acesso).
    const { data } = await supabase.auth.getUser();
    const destino = data?.user?.user_metadata?.tipo === "vendedor" ? "/vendedor/dashboard" : "/dashboard";
    setTimeout(() => router.push(destino), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
      <div className="card w-full max-w-md">
        <h1 className="font-display text-2xl font-bold text-navy-900">Criar nova senha</h1>

        {!pronto ? (
          <p className="mt-4 text-navy-500">Carregando...</p>
        ) : sucesso ? (
          <p className="mt-4 text-emerald-700">Senha atualizada! Redirecionando para o seu painel...</p>
        ) : !temSessao ? (
          <div className="mt-4 space-y-3">
            <p className="text-navy-600">
              Este link de recuperação não é válido ou já expirou. Peça um novo link na tela de
              login, em &quot;Esqueci minha senha&quot;.
            </p>
            <a href="/" className="btn-primary inline-block">
              Voltar ao início
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="label-field">Nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                className="input-field"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="label-field">Confirmar nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                className="input-field"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {erro && <p className="text-sm text-coral-700">{erro}</p>}

            <button type="submit" disabled={salvando} className="btn-primary w-full">
              {salvando ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
