"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import BotaoExcluirComAuditoria from "@/components/BotaoExcluirComAuditoria";

const emptyForm = { pergunta: "", opcoes: ["", ""], dataLimite: "" };

export default function EnquetesPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const [enquetes, setEnquetes] = useState([]);
  const [votos, setVotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [votando, setVotando] = useState(null);

  const podeGerenciar = temPermissao("enquetes", "editar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const [e, v] = await Promise.all([
      supabase.from("enquetes").select("*").eq("condominio_id", condominio.id).order("created_at", { ascending: false }),
      supabase.from("enquete_votos").select("*").eq("condominio_id", condominio.id),
    ]);
    if (e.error) setError(e.error.message);
    else setEnquetes(e.data || []);
    if (!v.error) setVotos(v.data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function handleOpcaoChange(index, valor) {
    setForm((f) => {
      const opcoes = [...f.opcoes];
      opcoes[index] = valor;
      return { ...f, opcoes };
    });
  }

  function handleAddOpcao() {
    setForm((f) => ({ ...f, opcoes: [...f.opcoes, ""] }));
  }

  function handleRemoveOpcao(index) {
    setForm((f) => ({ ...f, opcoes: f.opcoes.filter((_, i) => i !== index) }));
  }

  async function handleCreate(ev) {
    ev.preventDefault();
    const opcoes = form.opcoes.map((o) => o.trim()).filter(Boolean);
    if (!condominio?.id || !form.pergunta.trim() || opcoes.length < 2) {
      setError("Informe a pergunta e pelo menos duas opções de resposta.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error: insertError } = await supabase.from("enquetes").insert({
      condominio_id: condominio.id,
      pergunta: form.pergunta.trim(),
      opcoes,
      data_limite: form.dataLimite || null,
    });
    setSubmitting(false);
    if (insertError) return setError(insertError.message);
    setForm(emptyForm);
    load();
  }

  async function handleEncerrar(enquete) {
    const { error: updateError } = await supabase.from("enquetes").update({ status: "encerrada" }).eq("id", enquete.id);
    if (updateError) setError(updateError.message);
    else load();
  }

  async function handleVotar(enquete, opcao) {
    setVotando(enquete.id);
    setError("");
    const { error: insertError } = await supabase.from("enquete_votos").insert({
      enquete_id: enquete.id,
      condominio_id: condominio.id,
      user_id: user.id,
      unidade: member?.unidade || null,
      opcao,
    });
    setVotando(null);
    if (insertError) {
      if (insertError.code === "23505") {
        setError("Essa unidade já respondeu essa enquete.");
      } else if (insertError.code === "42501") {
        setError("Você não tem permissão para responder enquetes — fale com o síndico.");
      } else {
        setError(`Não foi possível responder: ${insertError.message}`);
      }
      load();
      return;
    }
    load();
  }

  if (!condominio) return <p className="text-navy-500">Carregando condomínio...</p>;

  return (
    <ModuloGuard modulo="enquetes">
      <div className="space-y-6">
        <div className="card">
          <h1 className="font-display text-xl font-bold text-navy-900">Enquetes</h1>
          <p className="mt-1 text-sm text-navy-500">
            {podeGerenciar ? "Pergunta rápida pro condomínio, sem a formalidade de uma assembleia." : "Responda as enquetes abertas."}
          </p>

          {podeGerenciar && (
            <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field">Pergunta</label>
                <input
                  className="input-field"
                  value={form.pergunta}
                  onChange={(e) => setForm((f) => ({ ...f, pergunta: e.target.value }))}
                  placeholder="Ex: Qual cor pra pintura da fachada?"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Opções de resposta</label>
                <div className="space-y-2">
                  {form.opcoes.map((opcao, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="input-field"
                        value={opcao}
                        onChange={(e) => handleOpcaoChange(i, e.target.value)}
                        placeholder={`Opção ${i + 1}`}
                        required={i < 2}
                      />
                      {form.opcoes.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOpcao(i)}
                          className="flex-none text-xs font-semibold text-coral hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleAddOpcao} className="mt-2 text-xs font-semibold text-navy-600 hover:underline">
                  + Adicionar opção
                </button>
              </div>
              <div>
                <label className="label-field">Encerra em (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataLimite}
                  onChange={(e) => setForm((f) => ({ ...f, dataLimite: e.target.value }))}
                />
              </div>
              <div className="flex items-end sm:col-span-2">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Criando..." : "Criar enquete"}
                </button>
              </div>
            </form>
          )}
        </div>

        {error && <p className="text-sm text-coral-700">{error}</p>}

        {loading ? (
          <p className="text-navy-500">Carregando enquetes...</p>
        ) : enquetes.length === 0 ? (
          <div className="card text-center text-navy-400">Nenhuma enquete criada ainda.</div>
        ) : (
          <div className="space-y-3">
            {enquetes.map((enq) => {
              const votosDaEnquete = votos.filter((v) => v.enquete_id === enq.id);
              // "Meu voto" cobre tanto o próprio login quanto qualquer outro
              // morador da mesma unidade — a unidade só responde uma vez.
              const meuVoto = votosDaEnquete.find(
                (v) => v.user_id === user?.id || (member?.unidade && v.unidade === member.unidade)
              );
              return (
                <div key={enq.id} className="card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-navy-900">{enq.pergunta}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          enq.status === "aberta" ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
                        }`}
                      >
                        {enq.status === "aberta" ? "Aberta" : "Encerrada"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {podeGerenciar && enq.status === "aberta" && (
                        <button onClick={() => handleEncerrar(enq)} className="text-xs font-semibold text-navy-500 hover:underline">
                          Encerrar
                        </button>
                      )}
                      {podeGerenciar && (
                        <BotaoExcluirComAuditoria
                          tabela="enquetes"
                          modulo="enquetes"
                          registroId={enq.id}
                          descricao="esta enquete"
                          onExcluido={load}
                          className="text-xs font-semibold text-coral hover:underline"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(enq.opcoes || []).map((opcao) => {
                      const qtd = votosDaEnquete.filter((v) => v.opcao === opcao).length;
                      const jaVotouNessa = meuVoto?.opcao === opcao;
                      return (
                        <button
                          key={opcao}
                          onClick={() => handleVotar(enq, opcao)}
                          disabled={Boolean(meuVoto) || votando === enq.id || enq.status !== "aberta"}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                            jaVotouNessa
                              ? "border-coral bg-coral text-white"
                              : "border-navy-200 text-navy-700 hover:bg-navy-50 disabled:opacity-60"
                          }`}
                        >
                          {opcao} <span className="opacity-70">({qtd})</span>
                        </button>
                      );
                    })}
                  </div>
                  {meuVoto && (
                    <p className="text-xs text-navy-400">
                      {meuVoto.user_id === user?.id ? "Você" : "Sua unidade"} respondeu: {meuVoto.opcao}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModuloGuard>
  );
}
