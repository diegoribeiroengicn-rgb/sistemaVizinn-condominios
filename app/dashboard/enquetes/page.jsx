"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import BotaoExcluirComAuditoria from "@/components/BotaoExcluirComAuditoria";

const emptyForm = { pergunta: "", opcoes: ["", ""], dataLimite: "", secreto: false };

export default function EnquetesPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const [enquetes, setEnquetes] = useState([]);
  // Contagem por enquete: { [enqueteId]: { [opcao]: quantidade } }
  const [resultados, setResultados] = useState({});
  // "Quem votou" (nunca tem a opção se a enquete for secreta): { [enqueteId]: linhas de enquete_participantes }
  const [participantes, setParticipantes] = useState({});
  // Só preenchido pra quem tem "editar" (síndico/subsíndico) — o voto
  // em si, pra cruzar com participantes e mostrar "quem votou o quê"
  // numa enquete NÃO secreta. Numa enquete secreta, a RLS garante que
  // essas linhas vêm sem user_id/unidade (ver schema), então o cruzamento
  // abaixo nunca encontra nada pra elas.
  const [votosDetalhados, setVotosDetalhados] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [votando, setVotando] = useState(null);
  const [auditoriaAbertaId, setAuditoriaAbertaId] = useState(null);

  const podeGerenciar = temPermissao("enquetes", "editar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");

    const { data: enquetesData, error: enquetesError } = await supabase
      .from("enquetes")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false });
    if (enquetesError) {
      setError(enquetesError.message);
      setLoading(false);
      return;
    }
    setEnquetes(enquetesData || []);

    const [resultadosPorEnquete, participantesData, votosData] = await Promise.all([
      Promise.all(
        (enquetesData || []).map(async (enq) => {
          const { data, error: rpcError } = await supabase.rpc("resultado_enquete", { p_enquete_id: enq.id });
          if (rpcError) return [enq.id, {}];
          const mapa = {};
          for (const row of data || []) mapa[row.opcao] = Number(row.quantidade);
          return [enq.id, mapa];
        })
      ),
      supabase.from("enquete_participantes").select("*").eq("condominio_id", condominio.id),
      podeGerenciar
        ? supabase.from("enquete_votos").select("*").eq("condominio_id", condominio.id)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setResultados(Object.fromEntries(resultadosPorEnquete));

    if (!participantesData.error) {
      const porEnquete = {};
      for (const p of participantesData.data || []) {
        (porEnquete[p.enquete_id] ||= []).push(p);
      }
      setParticipantes(porEnquete);
    }

    if (!votosData.error) {
      const porEnquete = {};
      for (const v of votosData.data || []) {
        (porEnquete[v.enquete_id] ||= []).push(v);
      }
      setVotosDetalhados(porEnquete);
    }

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
      secreto: form.secreto,
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
    const { error: rpcError } = await supabase.rpc("votar_enquete", {
      p_enquete_id: enquete.id,
      p_opcao: opcao,
    });
    setVotando(null);
    if (rpcError) {
      if (rpcError.code === "23505") {
        setError("Essa unidade já respondeu essa enquete.");
      } else {
        setError(`Não foi possível responder: ${rpcError.message}`);
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
              <div className="sm:col-span-2">
                <label className="flex items-start gap-2 text-sm text-navy-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.secreto}
                    onChange={(e) => setForm((f) => ({ ...f, secreto: e.target.checked }))}
                  />
                  <span>
                    Voto secreto
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
              const contagem = resultados[enq.id] || {};
              const participantesDaEnquete = participantes[enq.id] || [];
              // "Já votei" cobre o próprio login e qualquer outro morador
              // da mesma unidade — a unidade só responde uma vez. Vem de
              // enquete_participantes (existe mesmo em enquete secreta,
              // só nunca tem a opção escolhida).
              const meuParticipante = participantesDaEnquete.find(
                (p) => p.user_id === user?.id || (member?.unidade && p.unidade === member.unidade)
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
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          enq.secreto ? "bg-navy-800 text-white" : "bg-navy-100 text-navy-500"
                        }`}
                      >
                        {enq.secreto ? "🔒 Voto secreto" : "Voto não secreto"}
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

                  <p className="text-xs text-navy-400">
                    {enq.secreto
                      ? "🔒 Voto secreto — sua resposta não fica vinculada ao seu usuário em nenhum lugar do sistema. Nem o síndico consegue ver o que você escolheu, só que você (ou sua unidade) já participou."
                      : "Voto não secreto — o síndico pode ver, na auditoria, quem votou em cada opção."}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {(enq.opcoes || []).map((opcao) => {
                      const qtd = contagem[opcao] || 0;
                      return (
                        <button
                          key={opcao}
                          onClick={() => handleVotar(enq, opcao)}
                          disabled={Boolean(meuParticipante) || votando === enq.id || enq.status !== "aberta"}
                          className="rounded-full border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {opcao} <span className="opacity-70">({qtd})</span>
                        </button>
                      );
                    })}
                  </div>
                  {meuParticipante && (
                    <p className="text-xs text-navy-400">
                      {meuParticipante.user_id === user?.id ? "Você" : "Sua unidade"} já respondeu essa enquete.
                    </p>
                  )}

                  {podeGerenciar && (
                    <div className="border-t border-navy-100 pt-2">
                      <button
                        onClick={() => setAuditoriaAbertaId((id) => (id === enq.id ? null : enq.id))}
                        className="text-xs font-semibold text-navy-600 hover:underline"
                      >
                        {auditoriaAbertaId === enq.id ? "Ocultar" : "Ver"} quem votou ({participantesDaEnquete.length})
                      </button>
                      {auditoriaAbertaId === enq.id && (
                        <ul className="mt-2 space-y-1 text-xs text-navy-600">
                          {participantesDaEnquete.length === 0 ? (
                            <li className="text-navy-400">Ninguém votou ainda.</li>
                          ) : (
                            participantesDaEnquete.map((p) => {
                              const votoDaPessoa = !enq.secreto
                                ? (votosDetalhados[enq.id] || []).find((v) => v.user_id === p.user_id)
                                : null;
                              return (
                                <li key={p.id}>
                                  {p.nome || "Síndico"}
                                  {p.unidade ? ` (unid. ${p.unidade})` : ""}
                                  {votoDaPessoa ? ` — votou: ${votoDaPessoa.opcao}` : enq.secreto ? " — voto secreto" : ""}
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
            })}
          </div>
        )}
      </div>
    </ModuloGuard>
  );
}
