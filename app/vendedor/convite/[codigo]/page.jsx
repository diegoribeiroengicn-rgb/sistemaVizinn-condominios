"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ConviteVendedorPage() {
  const params = useParams();
  const codigo = params.codigo;

  const [indicadorNome, setIndicadorNome] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "", confirmarSenha: "" });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    fetch(`/api/vendedor/convite/${codigo}`)
      .then((r) => r.json().then((json) => ({ ok: r.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.error || "Código inválido.");
        setIndicadorNome(json.indicadorNome);
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [codigo]);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    if (form.senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (form.senha !== form.confirmarSenha) {
      setErro("As senhas não são iguais.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/vendedor/convite/${codigo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao enviar cadastro.");
      setEnviado(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-navy-900">Seja um vendedor Vizinn</h1>

        {carregando ? (
          <p className="mt-4 text-navy-500">Carregando convite...</p>
        ) : erro && !indicadorNome ? (
          <p className="mt-4 text-coral-700">{erro}</p>
        ) : enviado ? (
          <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-emerald-700">
            Cadastro enviado! Nossa equipe vai analisar e ativar seu acesso em breve. Quando for aprovado, entre em{" "}
            <a href="/vendedor/login" className="font-semibold underline">
              /vendedor/login
            </a>{" "}
            com o e-mail e a senha que você acabou de escolher — não precisa de mais nenhum passo.
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-navy-500">
              Você foi convidado por <strong>{indicadorNome}</strong> pra fazer parte do time de vendedores Vizinn.
            </p>
            <form onSubmit={enviar} className="mt-6 space-y-3">
              {erro && <p className="text-sm text-coral-700">{erro}</p>}
              <div>
                <label className="label-field">Nome completo</label>
                <input
                  className="input-field"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label-field">E-mail</label>
                <input
                  type="email"
                  className="input-field"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label-field">Telefone (opcional)</label>
                <input
                  className="input-field"
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Escolha uma senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input-field"
                  value={form.senha}
                  onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="label-field">Confirmar senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input-field"
                  value={form.confirmarSenha}
                  onChange={(e) => setForm((f) => ({ ...f, confirmarSenha: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <p className="text-xs text-navy-400">
                Você já cria sua conta com essa senha — sem precisar de nenhum e-mail. Só falta a aprovação do
                administrador Vizinn pra você começar a vender.
              </p>
              <button type="submit" disabled={enviando} className="btn-primary w-full">
                {enviando ? "Enviando..." : "Quero ser vendedor"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
