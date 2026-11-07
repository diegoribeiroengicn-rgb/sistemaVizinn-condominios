"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import BotaoExcluirComAuditoria from "@/components/BotaoExcluirComAuditoria";

const emptyAssembleia = { titulo: "", descricao: "", dataEncerramento: "", secreto: false };
const emptyPauta = { titulo: "", descricao: "" };
const OPCOES_PADRAO = ["Aprovar", "Rejeitar", "Abster-se"];

export default function AssembleiasPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const [assembleias, setAssembleias] = useState([]);
  const [pautas, setPautas] = useState([]);
  // Contagem por pauta: { [pautaId]: { [opcao]: quantidade } }
  const [resultados, setResultados] = useState({});
  // "Quem votou" (nunca tem a opção se a assembleia for secreta): { [pautaId]: linhas de assembleia_participantes }
  const [participantes, setParticipantes] = useState({});
  // Só preenchido pra quem tem "editar" — o voto em si, pra cruzar com
  // participantes e mostrar "quem votou o quê" numa assembleia NÃO
  // secreta (numa secreta, essas linhas vêm sem identidade da RLS).
  const [votosDetalhados, setVotosDetalhados] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyAssembleia);
  const [submitting, setSubmitting] = useState(false);
  const [pautaForm, setPautaForm] = useState({});
  const [votando, setVotando] = useState(null);
  const [auditoriaAbertaId, setAuditoriaAbertaId] = useState(null);

  // "criar" é o que o condômino tem por padrão pra poder VOTAR — não
  // confundir com gerenciar (criar/editar assembleia e pauta, encerrar,
  // ver auditoria), que exige "editar" (só síndico/subsíndico têm por
  // padrão). Usar "criar" aqui seria dar os controles de gerenciar pra
  // qualquer condômino, só porque ele tem permissão de votar.
  const podeGerenciar = temPermissao("assembleias", "editar");

  // Nunca mexe em `error` aqui: load() é chamada logo depois de um erro
  // de voto ser registrado (ver handleVotar), e se ela limpasse o erro
  // a mensagem desaparecia antes do React chegar a desenhar a tela.
  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);

    const [a, p] = await Promise.all([
      supabase.from("assembleias").select("*").eq("condominio_id", condominio.id).order("created_at", { ascending: false }),
      supabase.from("assembleia_pautas").select("*").eq("condominio_id", condominio.id).order("created_at", { ascending: true }),
    ]);
    if (a.error) {
      setError(a.error.message);
      setLoading(false);
      return;
    }
    setAssembleias(a.data || []);
    const pautasData = p.error ? [] : p.data || [];
    setPautas(pautasData);

    const [resultadosPorPauta, participantesData, votosData] = await Promise.all([
      Promise.all(
        pautasData.map(async (pauta) => {
          const { data, error: rpcError } = await supabase.rpc("resultado_pauta", { p_pauta_id: pauta.id });
          if (rpcError) return [pauta.id, {}];
          const mapa = {};
          for (const row of data || []) mapa[row.opcao] = Number(row.quantidade);
          return [pauta.id, mapa];
        })
      ),
      supabase.from("assembleia_participantes").select("*").eq("condominio_id", condominio.id),
      podeGerenciar
        ? supabase.from("assembleia_votos").select("*").eq("condominio_id", condominio.id)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setResultados(Object.fromEntries(resultadosPorPauta));

    if (!participantesData.error) {
      const porPauta = {};
      for (const pp of participantesData.data || []) {
        (porPauta[pp.pauta_id] ||= []).push(pp);
      }
      setParticipantes(porPauta);
    }

    if (!votosData.error) {
      const porPauta = {};
      for (const v of votosData.data || []) {
        (porPauta[v.pauta_id] ||= []).push(v);
      }
      setVotosDetalhados(porPauta);
    }

    setLoading(false);
  }, [condominio?.id, podeGerenciar]);

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
      secreto: form.secreto,
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
    let mensagemErro = "";
    try {
      const { error: rpcError } = await supabase.rpc("votar_pauta", {
        p_pauta_id: pauta.id,
        p_opcao: opcao,
      });
      if (rpcError) {
        mensagemErro =
          rpcError.code === "23505" ? "Essa unidade já votou nessa pauta." : `Não foi possível registrar o voto: ${rpcError.message}`;
      }
    } catch (err) {
      mensagemErro = `Não foi possível registrar o voto: ${err.message || "erro desconhecido"}`;
    }
    setVotando(null);
    await load();
    if (mensagemErro) setError(mensagemErro);
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
              : "Vote nas pautas abertas — um voto por unidade."}
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
              <div className="sm:col-span-2">
                <label className="flex items-start gap-2 text-sm text-navy-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.secreto}
                    onChange={(e) => setForm((f) => ({ ...f, secreto: e.target.checked }))}
                  />
                  <span>
                    Voto secreto (vale pra todas as pautas desta assembleia)
                    <span className="block text-xs text-navy-400">
                      {form.secreto
                        ? "Ninguém, nem você, vai conseguir ver quem votou em quê — nem no banco de dados existe esse vínculo. Só dá pra ver o total de cada opção e quem participou."
                        : "Você vai poder ver, na auditoria, quem votou em cada opção. Isso não muda depois de criada."}
                    </span>
                  </span>
                </label>
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
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            a.secreto ? "bg-navy-800 text-white" : "bg-navy-100 text-navy-500"
                          }`}
                        >
                          {a.secreto ? "🔒 Voto secreto" : "Voto não secreto"}
                        </span>
                      </div>
                      {a.descricao && <p className="mt-1 text-sm text-navy-600">{a.descricao}</p>}
                      {a.data_encerramento && (
                        <p className="mt-1 text-xs text-navy-400">
                          Encerra em {new Date(`${a.data_encerramento}T00:00:00`).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-navy-400">
                        {a.secreto
                          ? "🔒 Voto secreto — sua resposta não fica vinculada ao seu usuário em nenhum lugar do sistema. Nem o síndico consegue ver o que você escolheu, só que você (ou sua unidade) já participou."
                          : "Voto não secreto — o síndico pode ver, na auditoria, quem votou em cada opção."}
                      </p>
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
                        const contagem = resultados[p.id] || {};
                        const participantesDaPauta = participantes[p.id] || [];
                        const meuParticipante = participantesDaPauta.find(
                          (pp) => pp.user_id === user?.id || (member?.unidade && pp.unidade === member.unidade)
                        );
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
                                const qtd = contagem[opcao] || 0;
                                return (
                                  <button
                                    key={opcao}
                                    onClick={() => handleVotar(p, opcao)}
                                    disabled={Boolean(meuParticipante) || votando === p.id || a.status !== "aberta"}
                                    className="rounded-full border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {opcao} <span className="opacity-70">({qtd})</span>
                                  </button>
                                );
                              })}
                            </div>
                            {meuParticipante && (
                              <p className="mt-2 text-xs text-navy-400">
                                {meuParticipante.user_id === user?.id ? "Você" : "Sua unidade"} já votou nessa pauta.
                              </p>
                            )}

                            {podeGerenciar && (
                              <div className="mt-2 border-t border-navy-100 pt-2">
                                <button
                                  onClick={() => setAuditoriaAbertaId((id) => (id === p.id ? null : p.id))}
                                  className="text-xs font-semibold text-navy-600 hover:underline"
                                >
                                  {auditoriaAbertaId === p.id ? "Ocultar" : "Ver"} quem votou ({participantesDaPauta.length})
                                </button>
                                {auditoriaAbertaId === p.id && (
                                  <ul className="mt-2 space-y-1 text-xs text-navy-600">
                                    {participantesDaPauta.length === 0 ? (
                                      <li className="text-navy-400">Ninguém votou ainda.</li>
                                    ) : (
                                      participantesDaPauta.map((pp) => {
                                        const votoDaPessoa = !a.secreto
                                          ? (votosDetalhados[p.id] || []).find((v) => v.user_id === pp.user_id)
                                          : null;
                                        return (
                                          <li key={pp.id}>
                                            {pp.nome || "Síndico"}
                                            {pp.unidade ? ` (unid. ${pp.unidade})` : ""}
                                            {votoDaPessoa ? ` — votou: ${votoDaPessoa.opcao}` : a.secreto ? " — voto secreto" : ""}
                                          </li>
                                        );
                                      })
                                    )}
                                  </ul>
                                )}
                              </div>
                            )}
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
