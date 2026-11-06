"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import BotaoExcluirComAuditoria from "@/components/BotaoExcluirComAuditoria";

const emptyAssembleia = { titulo: "", descricao: "", dataEncerramento: "" };
const emptyPauta = { titulo: "", descricao: "" };
const OPCOES_PADRAO = ["Aprovar", "Rejeitar", "Abster-se"];

export default function AssembleiasPage() {
  const { condominio, user, member, temPermissao, role } = useAuth();
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";
  const [assembleias, setAssembleias] = useState([]);
  const [pautas, setPautas] = useState([]);
  const [votos, setVotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyAssembleia);
  const [submitting, setSubmitting] = useState(false);
  const [pautaForm, setPautaForm] = useState({});
  const [pautaAbertaId, setPautaAbertaId] = useState(null);
  const [votando, setVotando] = useState(null);

  const podeGerenciar = temPermissao("assembleias", "criar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const [a, p, v] = await Promise.all([
      supabase.from("assembleias").select("*").eq("condominio_id", condominio.id).order("created_at", { ascending: false }),
      supabase.from("assembleia_pautas").select("*").eq("condominio_id", condominio.id).order("created_at", { ascending: true }),
      supabase.from("assembleia_votos").select("*").eq("condominio_id", condominio.id),
    ]);
    if (a.error) setError(a.error.message);
    else setAssembleias(a.data || []);
    if (!p.error) setPautas(p.data || []);
    if (!v.error) setVotos(v.data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateAssembleia(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim()) return;
    setSubmitting(true);
    setError("");
    const { error: insertError } = await supabase.from("assembleias").insert({
      condominio_id: condominio.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      data_encerramento: form.dataEncerramento || null,
    });
    setSubmitting(false);
    if (insertError) return setError(insertError.message);
    setForm(emptyAssembleia);
    load();
  }

  async function handleEncerrar(assembleia) {
    const { error: updateError } = await supabase
      .from("assembleias")
      .update({ status: "encerrada" })
      .eq("id", assembleia.id);
    if (updateError) setError(updateError.message);
    else load();
  }

  async function handleCreatePauta(e, assembleiaId) {
    e.preventDefault();
    const dados = pautaForm[assembleiaId] || emptyPauta;
    if (!dados.titulo?.trim()) return;
    const { error: insertError } = await supabase.from("assembleia_pautas").insert({
      assembleia_id: assembleiaId,
      condominio_id: condominio.id,
      titulo: dados.titulo.trim(),
      descricao: dados.descricao?.trim() || null,
      opcoes: OPCOES_PADRAO,
    });
    if (insertError) return setError(insertError.message);
    setPautaForm((f) => ({ ...f, [assembleiaId]: emptyPauta }));
    load();
  }

  async function handleVotar(pauta, opcao) {
    setVotando(pauta.id);
    setError("");
    const { error: insertError } = await supabase.from("assembleia_votos").insert({
      pauta_id: pauta.id,
      condominio_id: condominio.id,
      user_id: user.id,
      votante_nome: nomeUsuario,
      unidade: member?.unidade || null,
      opcao,
    });
    setVotando(null);
    if (insertError) return setError("Não foi possível registrar o voto — você já votou nessa pauta?");
    load();
  }

  if (!condominio) return <p className="text-navy-500">Carregando condomínio...</p>;

  return (
    <ModuloGuard modulo="assembleias">
      <div className="space-y-6">
        <div className="card">
          <h1 className="font-display text-xl font-bold text-navy-900">Assembleias</h1>
          <p className="mt-1 text-sm text-navy-500">
            {podeGerenciar
              ? "Crie a assembleia, adicione as pautas e acompanhe a votação em tempo real."
              : "Vote nas pautas abertas — um voto por pessoa, visível pra todo mundo."}
          </p>

          {podeGerenciar && (
            <form onSubmit={handleCreateAssembleia} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field">Título</label>
                <input
                  className="input-field"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Assembleia Geral Ordinária 2026"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Descrição (opcional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Encerra em (opcional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.dataEncerramento}
                  onChange={(e) => setForm((f) => ({ ...f, dataEncerramento: e.target.value }))}
                />
              </div>
              <div className="flex items-end sm:col-span-2">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Criando..." : "Criar assembleia"}
                </button>
              </div>
            </form>
          )}
        </div>

        {error && <p className="text-sm text-coral-700">{error}</p>}

        {loading ? (
          <p className="text-navy-500">Carregando assembleias...</p>
        ) : assembleias.length === 0 ? (
          <div className="card text-center text-navy-400">Nenhuma assembleia criada ainda.</div>
        ) : (
          <div className="space-y-4">
            {assembleias.map((a) => {
              const pautasDaAssembleia = pautas.filter((p) => p.assembleia_id === a.id);
              return (
                <div key={a.id} className="card space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg font-bold text-navy-900">{a.titulo}</h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            a.status === "aberta" ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
                          }`}
                        >
                          {a.status === "aberta" ? "Aberta" : "Encerrada"}
                        </span>
                      </div>
                      {a.descricao && <p className="mt-1 text-sm text-navy-600">{a.descricao}</p>}
                      {a.data_encerramento && (
                        <p className="mt-1 text-xs text-navy-400">
                          Encerra em {new Date(`${a.data_encerramento}T00:00:00`).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    {podeGerenciar && a.status === "aberta" && (
                      <button onClick={() => handleEncerrar(a)} className="text-xs font-semibold text-navy-500 hover:underline">
                        Encerrar assembleia
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-navy-100 pt-4">
                    {pautasDaAssembleia.length === 0 ? (
                      <p className="text-sm text-navy-400">Nenhuma pauta ainda.</p>
                    ) : (
                      pautasDaAssembleia.map((p) => {
                        const votosDaPauta = votos.filter((v) => v.pauta_id === p.id);
                        const meuVoto = votosDaPauta.find((v) => v.user_id === user?.id);
                        return (
                          <div key={p.id} className="rounded-lg border border-navy-100 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-navy-900">{p.titulo}</p>
                                {p.descricao && <p className="mt-0.5 text-sm text-navy-500">{p.descricao}</p>}
                              </div>
                              {podeGerenciar && (
                                <BotaoExcluirComAuditoria
                                  tabela="assembleia_pautas"
                                  modulo="assembleias"
                                  registroId={p.id}
                                  descricao="esta pauta"
                                  onExcluido={load}
                                  className="flex-none text-xs font-semibold text-coral hover:underline"
                                />
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {(p.opcoes || OPCOES_PADRAO).map((opcao) => {
                                const qtd = votosDaPauta.filter((v) => v.opcao === opcao).length;
                                const jaVotouNessa = meuVoto?.opcao === opcao;
                                return (
                                  <button
                                    key={opcao}
                                    onClick={() => handleVotar(p, opcao)}
                                    disabled={Boolean(meuVoto) || votando === p.id || a.status !== "aberta"}
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
                            {meuVoto && <p className="mt-2 text-xs text-navy-400">Você votou: {meuVoto.opcao}</p>}
                          </div>
                        );
                      })
                    )}

                    {podeGerenciar && a.status === "aberta" && (
                      <form onSubmit={(e) => handleCreatePauta(e, a.id)} className="flex flex-wrap items-end gap-2 pt-2">
                        <div className="flex-1" style={{ minWidth: 200 }}>
                          <label className="label-field">Nova pauta</label>
                          <input
                            className="input-field"
                            value={pautaForm[a.id]?.titulo || ""}
                            onChange={(e) =>
                              setPautaForm((f) => ({ ...f, [a.id]: { ...(f[a.id] || emptyPauta), titulo: e.target.value } }))
                            }
                            placeholder="Ex: Aprovação do orçamento 2026"
                          />
                        </div>
                        <button type="submit" className="btn-secondary text-sm">
                          Adicionar pauta
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModuloGuard>
  );
}
