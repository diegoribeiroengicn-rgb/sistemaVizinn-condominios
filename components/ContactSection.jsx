"use client";

import { useState } from "react";

export default function ContactSection() {
  const [form, setForm] = useState({ nome: "", email: "", mensagem: "" });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const res = await fetch("/api/contato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar sua mensagem.");
      setEnviado(true);
      setForm({ nome: "", email: "", mensagem: "" });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section id="contato" className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">Fale conosco</h2>
        <p className="mx-auto mt-4 max-w-xl text-navy-600">
          Tem alguma dúvida ou quer conversar sobre o seu condomínio? Manda uma mensagem que respondemos por e-mail.
        </p>
      </div>

      <div className="card mt-8">
        {enviado ? (
          <div className="py-4 text-center">
            <p className="text-navy-700">
              Mensagem enviada! Vamos responder em breve no e-mail que você informou.
            </p>
            <button onClick={() => setEnviado(false)} className="mt-4 text-sm font-semibold text-coral hover:underline">
              Enviar outra mensagem
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="label-field">Mensagem</label>
              <textarea
                required
                rows={4}
                className="input-field"
                value={form.mensagem}
                onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
                placeholder="Como podemos ajudar?"
              />
            </div>

            {erro && <p className="text-sm text-coral-700">{erro}</p>}

            <button type="submit" disabled={enviando} className="btn-primary w-full">
              {enviando ? "Enviando..." : "Enviar mensagem"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
