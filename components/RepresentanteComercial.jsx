"use client";

import { useState } from "react";

const emptyForm = { nome: "", email: "", telefone: "", mensagem: "" };

// Seção de captação de representante comercial na landing page — só
// um botão que revela um formulário curto; ao enviar, chega um e-mail
// pro admin (ver /api/candidatura-vendedor). Não cria vendedor
// nenhum sozinho — quem aprova e cria o acesso é o admin, em
// /admin/pagamentos > Vendedores, do mesmo jeito que já faz hoje.
export default function RepresentanteComercial() {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const res = await fetch("/api/candidatura-vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar.");
      setEnviado(true);
      setForm(emptyForm);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="card text-center">
        <h2 className="font-display text-2xl font-bold text-navy-900">Quer vender Vizinn na sua região?</h2>
        <p className="mx-auto mt-2 max-w-lg text-navy-600">
          Procuramos representantes comerciais pra levar o Vizinn a mais condomínios. Deixa seu contato que a
          gente fala com você.
        </p>

        {enviado ? (
          <div className="mt-6">
            <p className="text-navy-700">Recebemos seu contato! Vamos falar com você em breve.</p>
            <button
              onClick={() => {
                setEnviado(false);
                setAberto(false);
              }}
              className="mt-3 text-sm font-semibold text-coral hover:underline"
            >
              Fechar
            </button>
          </div>
        ) : !aberto ? (
          <button onClick={() => setAberto(true)} className="btn-primary mt-6">
            Quero ser representante comercial
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
            <div>
              <label className="label-field">Nome</label>
              <input
                type="text"
                required
                className="input-field"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Seu nome"
              />
            </div>
            <div>
              <label className="label-field">E-mail</label>
              <input
                type="email"
                required
                className="input-field"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="voce@email.com"
              />
            </div>
            <div>
              <label className="label-field">Telefone/WhatsApp</label>
              <input
                type="tel"
                required
                className="input-field"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="label-field">Mensagem (opcional)</label>
              <textarea
                rows={3}
                className="input-field"
                value={form.mensagem}
                onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
                placeholder="Sua região, experiência com vendas, etc."
              />
            </div>

            {erro && <p className="text-sm text-coral-700">{erro}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={enviando} className="btn-primary flex-1">
                {enviando ? "Enviando..." : "Enviar contato"}
              </button>
              <button type="button" onClick={() => setAberto(false)} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
