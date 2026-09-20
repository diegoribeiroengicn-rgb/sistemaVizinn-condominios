"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/adminFetch";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import { PAPEIS_EQUIPE } from "@/lib/permissoes";
import {
  CATEGORIA_SUGESTOES,
  PRAZO_BADGE_STYLES,
  PRIORIDADE_LABELS,
  PRIORIDADE_ORDER,
  PRIORIDADE_STYLES,
  STATUS_FINAIS,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_STYLES,
  TIPO_LABELS,
  calcularStatusPrazo,
  sugerirDataPrevista,
} from "@/lib/chamados";

const emptyForm = {
  tipo: "condominio",
  titulo: "",
  descricao: "",
  categoria: "",
  prioridade: "normal",
  unidade: "",
  bloco: "",
  local: "",
  dataPrevista: "",
  responsavel: "",
  colaboradorId: "",
};

const emptyFiltro = { status: "", tipo: "", soAtrasados: false };

function formatarData(valor, comHora = false) {
  if (!valor) return "-";
  const data = new Date(valor);
  return comHora ? data.toLocaleString("pt-BR") : data.toLocaleDateString("pt-BR");
}

function Estrelas({ nota, onChange, tamanho = "text-lg" }) {
  return (
    <div className={`flex gap-0.5 ${tamanho}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={n <= nota ? "text-amber-500" : "text-navy-200"}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ChamadosPage() {
  const { condominio, user, member, role, temPermissao } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [chamados, setChamados] = useState([]);
  const [membros, setMembros] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [manutencoesVinculadas, setManutencoesVinculadas] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [filtro, setFiltro] = useState(emptyFiltro);
  const [gerenciandoId, setGerenciandoId] = useState(null);
  const [gerenciarForm, setGerenciarForm] = useState(null);
  const [salvandoGerenciamento, setSalvandoGerenciamento] = useState(false);
  const [avaliandoId, setAvaliandoId] = useState(null);
  const [avaliacaoForm, setAvaliacaoForm] = useState({ nota: 5, comentario: "" });
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);

  const podeCriar = temPermissao("chamados", "criar");
  const podeEditar = temPermissao("chamados", "editar");
  const podeGerarManutencao = podeEditar && temPermissao("manutencao", "criar");
  const isCondomino = role === "condomino";
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  // Pré-preenche o formulário quando chega vindo de "Gerar chamado" numa
  // ocorrência (?ocorrenciaId=...&titulo=...&descricao=...&unidade=...).
  useEffect(() => {
    const ocorrenciaId = searchParams.get("ocorrenciaId");
    if (!ocorrenciaId) return;
    setForm((f) => ({
      ...f,
      titulo: searchParams.get("titulo") || f.titulo,
      descricao: searchParams.get("descricao") || f.descricao,
      unidade: searchParams.get("unidade") || f.unidade,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");

    const queries = {
      chamados: supabase
        .from("chamados")
        .select("*")
        .eq("condominio_id", condominio.id)
        .order("created_at", { ascending: false }),
    };

    if (podeEditar) {
      queries.membros = supabase.from("membros").select("id, nome, papel, user_id").eq("condominio_id", condominio.id);
    }
    if (podeEditar && temPermissao("manutencao", "visualizar")) {
      queries.manutencoes = supabase
        .from("manutencoes")
        .select("id, titulo, chamado_origem_id")
        .eq("condominio_id", condominio.id)
        .not("chamado_origem_id", "is", null);
    }
    if (podeEditar && temPermissao("colaboradores", "visualizar")) {
      queries.colaboradores = supabase
        .from("colaboradores")
        .select("id, nome, funcao, status")
        .eq("condominio_id", condominio.id)
        .eq("status", "ativo")
        .order("nome", { ascending: true });
    }

    const chaves = Object.keys(queries);
    const resultados = await Promise.all(chaves.map((k) => queries[k]));
    const porChave = {};
    chaves.forEach((k, i) => {
      porChave[k] = resultados[i];
    });

    if (porChave.chamados.error) setError(porChave.chamados.error.message);
    else setChamados(porChave.chamados.data || []);

    if (porChave.membros && !porChave.membros.error) setMembros(porChave.membros.data || []);

    if (porChave.manutencoes && !porChave.manutencoes.error) {
      const mapa = {};
      for (const m of porChave.manutencoes.data || []) mapa[m.chamado_origem_id] = m;
      setManutencoesVinculadas(mapa);
    }

    if (porChave.colaboradores && !porChave.colaboradores.error) setColaboradores(porChave.colaboradores.data || []);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.id, podeEditar]);

  useEffect(() => {
    load();
  }, [load]);

  // Responsável só pode ser quem trabalha no prédio (síndico, subsíndico,
  // administrador, zelador, porteiro) — nunca condômino ou conselheiro.
  const responsaveis = useMemo(() => {
    const lista = [{ value: `sindico:${condominio?.owner_id}`, label: "Síndico", userId: condominio?.owner_id }];
    for (const m of membros) {
      if (!PAPEIS_EQUIPE.includes(m.papel)) continue;
      lista.push({ value: `membro:${m.user_id}`, label: `${m.nome}`, userId: m.user_id });
    }
    return lista;
  }, [membros, condominio?.owner_id]);

  const cargaPorResponsavel = useMemo(() => {
    const mapa = {};
    for (const c of chamados) {
      if (STATUS_FINAIS.includes(c.status) || !c.responsavel_id) continue;
      mapa[c.responsavel_id] = (mapa[c.responsavel_id] || 0) + 1;
    }
    return mapa;
  }, [chamados]);

  const colaboradorPorId = useMemo(() => {
    const mapa = {};
    for (const c of colaboradores) mapa[c.id] = c;
    return mapa;
  }, [colaboradores]);

  // Distribuição automática (opcional, ligada em Configurações): só entra
  // em ação quando o chamado é de condomínio e ninguém escolheu um
  // colaborador manualmente — atribui a quem tem menos chamados em aberto
  // agora. Nunca considera "disponibilidade", porque isso não é um dado
  // que o sistema guarda hoje.
  function escolherColaboradorAutomatico() {
    if (!colaboradores.length) return null;
    const carga = {};
    for (const c of colaboradores) carga[c.id] = 0;
    for (const c of chamados) {
      if (c.responsavel_colaborador_id && !STATUS_FINAIS.includes(c.status)) {
        carga[c.responsavel_colaborador_id] = (carga[c.responsavel_colaborador_id] || 0) + 1;
      }
    }
    return [...colaboradores].sort((a, b) => (carga[a.id] || 0) - (carga[b.id] || 0))[0];
  }

  function notificarResponsavel(chamado, { colaboradorId, membroUserId }) {
    if (!colaboradorId && !membroUserId) return;
    authedFetch("/api/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condominioId: condominio.id,
        evento: "chamado_atribuido",
        chamadoId: chamado.id,
        titulo: chamado.titulo,
        prioridade: chamado.prioridade,
        colaboradorId: colaboradorId || null,
        membroUserId: membroUserId || null,
      }),
    }).catch((err) => console.error("Erro ao notificar responsável:", err));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim()) return;

    setSubmitting(true);
    setError("");

    const responsavelSelecionado = responsaveis.find((r) => r.value === form.responsavel);
    const ocorrenciaId = searchParams.get("ocorrenciaId") || null;
    const tipoFinal = isCondomino ? "condominio" : form.tipo;

    let colaboradorId = form.colaboradorId || null;
    if (!colaboradorId && tipoFinal === "condominio" && condominio?.chamados_distribuicao_automatica) {
      colaboradorId = escolherColaboradorAutomatico()?.id || null;
    }

    const { data: chamadoCriado, error: insertError } = await supabase
      .from("chamados")
      .insert({
        condominio_id: condominio.id,
        tipo: tipoFinal,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria.trim() || null,
        prioridade: form.prioridade,
        unidade: tipoFinal === "condominio" ? form.unidade.trim() || null : null,
        bloco: tipoFinal === "condominio" ? form.bloco.trim() || null : null,
        local: tipoFinal === "interno" ? form.local.trim() || null : null,
        solicitante_id: user?.id || null,
        solicitante_nome: nomeUsuario,
        responsavel_id: responsavelSelecionado?.userId || null,
        responsavel_nome: responsavelSelecionado?.label || null,
        responsavel_colaborador_id: colaboradorId,
        data_prevista: form.dataPrevista || null,
        status: "aberto",
        ocorrencia_origem_id: ocorrenciaId,
      })
      .select()
      .single();
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    notificarResponsavel(chamadoCriado, {
      colaboradorId,
      membroUserId: !colaboradorId ? responsavelSelecionado?.userId : null,
    });

    setForm(emptyForm);
    if (ocorrenciaId) router.replace("/dashboard/chamados");
    load();
  }

  function abrirGerenciamento(chamado) {
    setGerenciandoId(chamado.id);
    setGerenciarForm({
      status: chamado.status,
      responsavel:
        responsaveis.find((r) => r.userId === chamado.responsavel_id)?.value || "",
      colaboradorId: chamado.responsavel_colaborador_id || "",
      executorNome: chamado.executor_nome || "",
      resultado: chamado.resultado || "",
    });
  }

  async function handleSalvarGerenciamento(chamado) {
    setSalvandoGerenciamento(true);
    setError("");

    const responsavelSelecionado = responsaveis.find((r) => r.value === gerenciarForm.responsavel);
    const vaiConcluir = gerenciarForm.status === "concluido" && chamado.status !== "concluido";

    if (vaiConcluir && !gerenciarForm.resultado.trim()) {
      setError("Descreva o resultado antes de marcar como concluído.");
      setSalvandoGerenciamento(false);
      return;
    }

    const updates = {
      status: gerenciarForm.status,
      responsavel_id: responsavelSelecionado?.userId || null,
      responsavel_nome: responsavelSelecionado?.label || null,
      responsavel_colaborador_id: gerenciarForm.colaboradorId || null,
      executor_nome: gerenciarForm.executorNome.trim() || null,
      resultado: gerenciarForm.resultado.trim() || null,
    };
    if (vaiConcluir) updates.data_conclusao = new Date().toISOString();

    const { error: updateError } = await supabase.from("chamados").update(updates).eq("id", chamado.id);
    setSalvandoGerenciamento(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const responsavelMudou =
      updates.responsavel_colaborador_id !== chamado.responsavel_colaborador_id ||
      updates.responsavel_id !== chamado.responsavel_id;
    if (responsavelMudou) {
      notificarResponsavel(
        { ...chamado, ...updates },
        {
          colaboradorId: updates.responsavel_colaborador_id,
          membroUserId: !updates.responsavel_colaborador_id ? updates.responsavel_id : null,
        }
      );
    }

    setGerenciandoId(null);
    setGerenciarForm(null);
    load();
  }

  async function handleEnviarAvaliacao(chamado) {
    setEnviandoAvaliacao(true);
    setError("");
    const { error: updateError } = await supabase
      .from("chamados")
      .update({
        avaliacao_nota: avaliacaoForm.nota,
        avaliacao_comentario: avaliacaoForm.comentario.trim() || null,
      })
      .eq("id", chamado.id);
    setEnviandoAvaliacao(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setAvaliandoId(null);
    setAvaliacaoForm({ nota: 5, comentario: "" });
    load();
  }

  function gerarManutencao(chamado) {
    const params = new URLSearchParams({
      chamadoId: chamado.id,
      titulo: chamado.titulo,
      descricao: chamado.descricao || "",
      unidade: chamado.unidade || "",
    });
    router.push(`/dashboard/manutencao?${params.toString()}`);
  }

  const chamadosFiltrados = useMemo(() => {
    return chamados.filter((c) => {
      if (filtro.status && c.status !== filtro.status) return false;
      if (filtro.tipo && c.tipo !== filtro.tipo) return false;
      if (filtro.soAtrasados) {
        const prazo = calcularStatusPrazo(c.data_prevista, c.status);
        if (!prazo?.atrasado) return false;
      }
      return true;
    });
  }, [chamados, filtro]);

  const resumo = useMemo(() => {
    if (!podeEditar) return null;
    const abertos = chamados.filter((c) => !STATUS_FINAIS.includes(c.status));
    const atrasados = abertos.filter((c) => calcularStatusPrazo(c.data_prevista, c.status)?.atrasado);
    const porStatus = {};
    for (const c of chamados) porStatus[c.status] = (porStatus[c.status] || 0) + 1;
    const concluidos = chamados.filter((c) => c.status === "concluido" && c.data_conclusao);
    const tempoMedioDias = concluidos.length
      ? (
          concluidos.reduce(
            (soma, c) => soma + (new Date(c.data_conclusao) - new Date(c.created_at)) / 86400000,
            0
          ) / concluidos.length
        ).toFixed(1)
      : null;
    const avaliados = chamados.filter((c) => c.avaliacao_nota);
    const notaMedia = avaliados.length
      ? (avaliados.reduce((s, c) => s + c.avaliacao_nota, 0) / avaliados.length).toFixed(1)
      : null;
    const internos = chamados.filter((c) => c.tipo === "interno").length;
    const semResponsavel = abertos.filter((c) => !c.responsavel_id && !c.responsavel_colaborador_id);
    const naoRespondidos = chamados.filter((c) => c.status === "aberto");

    return {
      abertos: abertos.length,
      atrasados: atrasados.length,
      semResponsavel: semResponsavel.length,
      naoRespondidos: naoRespondidos.length,
      porStatus,
      tempoMedioDias,
      notaMedia,
      internos,
    };
  }, [chamados, podeEditar]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="chamados">
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Chamados</h1>
        <p className="mt-1 text-sm text-navy-500">
          Registre e acompanhe solicitações — de condomínio (moradores e áreas comuns) ou internas
          (entre síndico, subsíndico, administradora, porteiro e zelador).
        </p>

        {podeCriar && (
          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label-field">Título</label>
              <input
                className="input-field"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Vazamento na garagem"
                required
              />
            </div>
            {!isCondomino && (
              <div>
                <label className="label-field">Tipo</label>
                <select
                  className="input-field"
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                >
                  <option value="condominio">{TIPO_LABELS.condominio}</option>
                  <option value="interno">{TIPO_LABELS.interno}</option>
                </select>
              </div>
            )}
            <div>
              <label className="label-field">Prioridade</label>
              <select
                className="input-field"
                value={form.prioridade}
                onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
              >
                {PRIORIDADE_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDADE_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Categoria (opcional)</label>
              <input
                className="input-field"
                list="categorias-sugeridas"
                value={form.categoria}
                onChange={(e) => {
                  const categoria = e.target.value;
                  setForm((f) => ({
                    ...f,
                    categoria,
                    dataPrevista: f.dataPrevista || sugerirDataPrevista(categoria),
                  }));
                }}
                placeholder="Ex: Hidráulica"
              />
              <datalist id="categorias-sugeridas">
                {CATEGORIA_SUGESTOES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            {(isCondomino ? "condominio" : form.tipo) === "condominio" ? (
              <>
                <div>
                  <label className="label-field">Unidade (opcional)</label>
                  <input
                    className="input-field"
                    value={form.unidade}
                    onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                    placeholder="Ex: 32"
                  />
                </div>
                <div>
                  <label className="label-field">Bloco (opcional)</label>
                  <input
                    className="input-field"
                    value={form.bloco}
                    onChange={(e) => setForm((f) => ({ ...f, bloco: e.target.value }))}
                    placeholder="Ex: B"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="label-field">Local (opcional)</label>
                <input
                  className="input-field"
                  value={form.local}
                  onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                  placeholder="Ex: Garagem, subsolo"
                />
              </div>
            )}
            <div>
              <label className="label-field">Data prevista (opcional)</label>
              <input
                type="date"
                className="input-field"
                value={form.dataPrevista}
                onChange={(e) => setForm((f) => ({ ...f, dataPrevista: e.target.value }))}
              />
            </div>
            {podeEditar && (
              <div>
                <label className="label-field">Responsável (opcional)</label>
                <select
                  className="input-field"
                  value={form.responsavel}
                  onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                >
                  <option value="">Sem responsável definido</option>
                  {responsaveis.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                      {cargaPorResponsavel[r.userId] ? ` — ${cargaPorResponsavel[r.userId]} em aberto` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {podeEditar && colaboradores.length > 0 && (
              <div>
                <label className="label-field">Colaborador responsável (opcional)</label>
                <select
                  className="input-field"
                  value={form.colaboradorId}
                  onChange={(e) => setForm((f) => ({ ...f, colaboradorId: e.target.value }))}
                >
                  <option value="">Sem colaborador vinculado</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} — {c.funcao}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label-field">Descrição (opcional)</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            {condominio?.chamados_distribuicao_automatica && !isCondomino && form.tipo === "condominio" && (
              <p className="sm:col-span-2 text-xs text-navy-500">
                Distribuição automática ativada: se você não escolher um colaborador, o sistema
                atribui a quem tem menos chamados em aberto agora.
              </p>
            )}
            {condominio?.chamados_distribuicao_automatica && isCondomino && (
              <p className="sm:col-span-2 text-xs text-navy-500">
                Distribuição automática ativada: o sistema atribui a quem tem menos chamados em
                aberto agora.
              </p>
            )}
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Criando..." : "Novo chamado"}
              </button>
            </div>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {resumo && (
        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-900">Resumo gerencial</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-navy-500">Em aberto</p>
              <p className="text-xl font-bold text-navy-900">{resumo.abertos}</p>
            </div>
            <div>
              <p className="text-xs text-navy-500">Atrasados</p>
              <p className="text-xl font-bold text-coral-700">{resumo.atrasados}</p>
            </div>
            <div>
              <p className="text-xs text-navy-500">Tempo médio de resolução</p>
              <p className="text-xl font-bold text-navy-900">
                {resumo.tempoMedioDias ? `${resumo.tempoMedioDias} dias` : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-500">Avaliação média</p>
              <p className="text-xl font-bold text-navy-900">{resumo.notaMedia ? `${resumo.notaMedia} ★` : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-navy-500">Sem responsável</p>
              <p className="text-xl font-bold text-navy-900">{resumo.semResponsavel}</p>
            </div>
            <div>
              <p className="text-xs text-navy-500">Não respondidos</p>
              <p className="text-xl font-bold text-navy-900">{resumo.naoRespondidos}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(resumo.porStatus).map(([status, qtd]) => (
              <span
                key={status}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
              >
                {STATUS_LABELS[status]}: {qtd}
              </span>
            ))}
          </div>
          {responsaveis.some((r) => cargaPorResponsavel[r.userId]) && (
            <div className="mt-3 text-xs text-navy-500">
              {responsaveis
                .filter((r) => cargaPorResponsavel[r.userId])
                .map((r) => (
                  <div key={r.value}>
                    {r.label} — {cargaPorResponsavel[r.userId]} chamados em aberto
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          className="input-field w-auto"
          value={filtro.status}
          onChange={(e) => setFiltro((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Todos os status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {!isCondomino && (
          <select
            className="input-field w-auto"
            value={filtro.tipo}
            onChange={(e) => setFiltro((f) => ({ ...f, tipo: e.target.value }))}
          >
            <option value="">Condomínio e interno</option>
            <option value="condominio">{TIPO_LABELS.condominio}</option>
            <option value="interno">{TIPO_LABELS.interno}</option>
          </select>
        )}
        <label className="flex items-center gap-1.5 text-sm text-navy-600">
          <input
            type="checkbox"
            checked={filtro.soAtrasados}
            onChange={(e) => setFiltro((f) => ({ ...f, soAtrasados: e.target.checked }))}
            className="h-4 w-4 rounded border-navy-300 text-coral focus:ring-coral"
          />
          Só atrasados
        </label>
      </div>

      {loading ? (
        <p className="text-navy-500">Carregando chamados...</p>
      ) : chamadosFiltrados.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum chamado encontrado.</div>
      ) : (
        <div className="space-y-3">
          {chamadosFiltrados.map((c) => {
            const prazo = calcularStatusPrazo(c.data_prevista, c.status);
            const manutencaoVinculada = manutencoesVinculadas[c.id];
            const podeAvaliar =
              c.status === "concluido" && c.solicitante_id === user?.id && !c.avaliacao_nota;

            return (
              <div key={c.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-navy-900">{c.titulo}</h3>
                      {c.tipo === "interno" && (
                        <span className="rounded-full bg-midnight px-2 py-0.5 text-xs font-medium text-white">
                          Interno
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORIDADE_STYLES[c.prioridade]}`}
                      >
                        {PRIORIDADE_LABELS[c.prioridade]}
                      </span>
                      {prazo && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRAZO_BADGE_STYLES[prazo.nivel]}`}
                        >
                          {prazo.emoji} {prazo.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-navy-400">
                      {[
                        c.categoria,
                        c.unidade && `Apto ${c.unidade}`,
                        c.bloco && `Bloco ${c.bloco}`,
                        c.local,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                {c.descricao && <p className="mt-2 text-sm text-navy-600">{c.descricao}</p>}

                <p className="mt-2 text-xs text-navy-500">
                  Solicitante: <strong>{c.solicitante_nome || "-"}</strong> · Responsável:{" "}
                  <strong>
                    {colaboradorPorId[c.responsavel_colaborador_id]?.nome || c.responsavel_nome || "Não definido"}
                  </strong>
                  {c.executor_nome && (
                    <>
                      {" "}
                      · Executor: <strong>{c.executor_nome}</strong>
                    </>
                  )}
                </p>

                <p className="mt-1 text-xs text-navy-400">
                  Aberto em {formatarData(c.created_at)}
                  {c.data_prevista && <> · Previsto para {formatarData(c.data_prevista)}</>}
                  {c.data_conclusao && <> · Concluído em {formatarData(c.data_conclusao, true)}</>}
                </p>

                {c.resultado && (
                  <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">
                    <strong>Resultado:</strong> {c.resultado}
                  </p>
                )}

                {c.ocorrencia_origem_id && (
                  <p className="mt-1 text-xs text-navy-400">Originado de uma ocorrência.</p>
                )}
                {manutencaoVinculada && (
                  <p className="mt-1 text-xs text-navy-400">
                    Manutenção vinculada: {manutencaoVinculada.titulo}
                  </p>
                )}

                {c.avaliacao_nota && (
                  <div className="mt-2 flex items-center gap-2">
                    <Estrelas nota={c.avaliacao_nota} />
                    {c.avaliacao_comentario && (
                      <span className="text-xs text-navy-500">&quot;{c.avaliacao_comentario}&quot;</span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-3">
                  {podeEditar && gerenciandoId !== c.id && (
                    <button
                      onClick={() => abrirGerenciamento(c)}
                      className="text-xs font-semibold text-navy-700 hover:underline"
                    >
                      Gerenciar
                    </button>
                  )}
                  {podeGerarManutencao && !manutencaoVinculada && (
                    <button
                      onClick={() => gerarManutencao(c)}
                      className="text-xs font-semibold text-navy-700 hover:underline"
                    >
                      Gerar manutenção
                    </button>
                  )}
                  {podeAvaliar && avaliandoId !== c.id && (
                    <button
                      onClick={() => setAvaliandoId(c.id)}
                      className="text-xs font-semibold text-coral hover:underline"
                    >
                      Avaliar atendimento
                    </button>
                  )}
                </div>

                {gerenciandoId === c.id && gerenciarForm && (
                  <div className="mt-3 space-y-2 rounded-xl border border-navy-100 p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="label-field">Status</label>
                        <select
                          className="input-field"
                          value={gerenciarForm.status}
                          onChange={(e) => setGerenciarForm((f) => ({ ...f, status: e.target.value }))}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label-field">Responsável</label>
                        <select
                          className="input-field"
                          value={gerenciarForm.responsavel}
                          onChange={(e) => setGerenciarForm((f) => ({ ...f, responsavel: e.target.value }))}
                        >
                          <option value="">Sem responsável definido</option>
                          {responsaveis.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label-field">Executor (opcional)</label>
                        <input
                          className="input-field"
                          value={gerenciarForm.executorNome}
                          onChange={(e) => setGerenciarForm((f) => ({ ...f, executorNome: e.target.value }))}
                          placeholder="Ex: Empresa ABC"
                        />
                      </div>
                      {colaboradores.length > 0 && (
                        <div>
                          <label className="label-field">Colaborador responsável (opcional)</label>
                          <select
                            className="input-field"
                            value={gerenciarForm.colaboradorId}
                            onChange={(e) => setGerenciarForm((f) => ({ ...f, colaboradorId: e.target.value }))}
                          >
                            <option value="">Sem colaborador vinculado</option>
                            {colaboradores.map((cl) => (
                              <option key={cl.id} value={cl.id}>
                                {cl.nome} — {cl.funcao}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    {gerenciarForm.status === "concluido" && (
                      <div>
                        <label className="label-field">Resultado</label>
                        <textarea
                          className="input-field"
                          rows={2}
                          value={gerenciarForm.resultado}
                          onChange={(e) => setGerenciarForm((f) => ({ ...f, resultado: e.target.value }))}
                          placeholder="O que foi feito pra resolver"
                        />
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSalvarGerenciamento(c)}
                        disabled={salvandoGerenciamento}
                        className="btn-primary text-sm"
                      >
                        {salvandoGerenciamento ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGerenciandoId(null);
                          setGerenciarForm(null);
                        }}
                        className="text-sm font-semibold text-navy-500 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {avaliandoId === c.id && (
                  <div className="mt-3 space-y-2 rounded-xl border border-navy-100 p-3">
                    <Estrelas
                      nota={avaliacaoForm.nota}
                      onChange={(nota) => setAvaliacaoForm((f) => ({ ...f, nota }))}
                    />
                    <textarea
                      className="input-field"
                      rows={2}
                      value={avaliacaoForm.comentario}
                      onChange={(e) => setAvaliacaoForm((f) => ({ ...f, comentario: e.target.value }))}
                      placeholder="Comentário (opcional)"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEnviarAvaliacao(c)}
                        disabled={enviandoAvaliacao}
                        className="btn-primary text-sm"
                      >
                        {enviandoAvaliacao ? "Enviando..." : "Enviar avaliação"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvaliandoId(null)}
                        className="text-sm font-semibold text-navy-500 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
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
