"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { calcularStatusPrazo, PRAZO_BADGE_STYLES } from "@/lib/chamados";
import { CATEGORIAS_SUGERIDAS, CRITERIOS_AVALIACAO } from "@/lib/fornecedores";

const STATUS_ORDER = ["aberta", "em_andamento", "concluida"];
const STATUS_LABELS = { aberta: "Aberta", em_andamento: "Em andamento", concluida: "Concluída" };
const STATUS_STYLES = {
  aberta: "bg-coral-100 text-coral-700",
  em_andamento: "bg-amber-100 text-amber-700",
  concluida: "bg-emerald-100 text-emerald-700",
};
const STATUS_FINAIS = ["concluida"];

const TIPO_LABELS = { avulsa: "Avulsa", preventiva: "Preventiva", recorrente: "Recorrente" };

const PERIODICIDADE_LABELS = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  personalizada: "Personalizada",
};

const emptyForm = {
  titulo: "",
  descricao: "",
  unidade: "",
  categoria: "",
  tipo: "avulsa",
  periodicidade: "mensal",
  periodicidadeDias: "",
  dataPrevista: "",
  fornecedorId: "",
  colaboradorId: "",
};

const emptyAvaliacao = { nota_qualidade: 5, nota_prazo: 5, nota_custo: 5, nota_atendimento: 5, observacao: "" };

function Estrelas({ nota, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={n <= nota ? "text-amber-500" : "text-navy-200"}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function calcularProximaData(periodicidade, periodicidadeDias, dataBase) {
  const data = new Date(`${dataBase}T00:00:00`);
  if (periodicidade === "semanal") data.setDate(data.getDate() + 7);
  else if (periodicidade === "quinzenal") data.setDate(data.getDate() + 14);
  else if (periodicidade === "mensal") data.setMonth(data.getMonth() + 1);
  else if (periodicidade === "trimestral") data.setMonth(data.getMonth() + 3);
  else if (periodicidade === "semestral") data.setMonth(data.getMonth() + 6);
  else if (periodicidade === "anual") data.setFullYear(data.getFullYear() + 1);
  else if (periodicidade === "personalizada") data.setDate(data.getDate() + (Number(periodicidadeDias) || 30));
  return data.toISOString().slice(0, 10);
}

export default function ManutencaoPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ordens, setOrdens] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [gerenciandoId, setGerenciandoId] = useState(null);
  const [gerenciarForm, setGerenciarForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [programandoId, setProgramandoId] = useState(null);

  const podeCriar = temPermissao("manutencao", "criar");
  const podeEditar = temPermissao("manutencao", "editar");
  const podeSolicitarProposta = temPermissao("propostas", "criar");
  const podeColaboradores = temPermissao("colaboradores", "visualizar");
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  useEffect(() => {
    const chamadoId = searchParams.get("chamadoId");
    if (!chamadoId) return;
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
    const [ordensResult, fornecedoresResult, colaboradoresResult] = await Promise.all([
      supabase.from("manutencoes").select("*").eq("condominio_id", condominio.id).order("created_at", { ascending: false }),
      temPermissao("fornecedores", "visualizar")
        ? supabase.from("fornecedores").select("id, razao_social").eq("condominio_id", condominio.id)
        : Promise.resolve({ data: [], error: null }),
      podeColaboradores
        ? supabase
            .from("colaboradores")
            .select("id, nome, funcao, status")
            .eq("condominio_id", condominio.id)
            .eq("status", "ativo")
            .order("nome", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (ordensResult.error) setError(ordensResult.error.message);
    else setOrdens(ordensResult.data || []);
    if (!fornecedoresResult.error) setFornecedores(fornecedoresResult.data || []);
    if (!colaboradoresResult.error) setColaboradores(colaboradoresResult.data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio?.id, podeColaboradores]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim()) return;

    setSubmitting(true);
    setError("");
    const chamadoId = searchParams.get("chamadoId") || null;
    const fornecedor = fornecedores.find((f) => f.id === form.fornecedorId);
    const { error: insertError } = await supabase.from("manutencoes").insert({
      condominio_id: condominio.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      unidade: form.unidade.trim() || null,
      categoria: form.categoria.trim() || null,
      tipo: form.tipo,
      periodicidade: form.tipo === "recorrente" ? form.periodicidade : null,
      periodicidade_dias:
        form.tipo === "recorrente" && form.periodicidade === "personalizada"
          ? Number(form.periodicidadeDias) || null
          : null,
      data_prevista: form.dataPrevista || null,
      fornecedor_id: form.fornecedorId || null,
      fornecedor_nome: fornecedor?.razao_social || null,
      responsavel_colaborador_id: form.colaboradorId || null,
      status: "aberta",
      chamado_origem_id: chamadoId,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    if (chamadoId) router.replace("/dashboard/manutencao");
    load();
  }

  function abrirGerenciamento(ordem) {
    setGerenciandoId(ordem.id);
    setGerenciarForm({
      status: ordem.status,
      fornecedorId: ordem.fornecedor_id || "",
      colaboradorId: ordem.responsavel_colaborador_id || "",
      resultado: ordem.resultado || "",
      avaliacao: emptyAvaliacao,
    });
  }

  async function handleSalvarGerenciamento(ordem) {
    setSalvando(true);
    setError("");
    const vaiConcluir = gerenciarForm.status === "concluida" && ordem.status !== "concluida";
    if (vaiConcluir && !gerenciarForm.resultado.trim()) {
      setError("Descreva o resultado antes de marcar como concluída.");
      setSalvando(false);
      return;
    }

    const fornecedor = fornecedores.find((f) => f.id === gerenciarForm.fornecedorId);
    const updates = {
      status: gerenciarForm.status,
      fornecedor_id: gerenciarForm.fornecedorId || null,
      fornecedor_nome: fornecedor?.razao_social || null,
      responsavel_colaborador_id: gerenciarForm.colaboradorId || null,
      resultado: gerenciarForm.resultado.trim() || null,
    };
    if (vaiConcluir) {
      updates.concluido_em = new Date().toISOString();
      updates.concluido_por_nome = nomeUsuario;
    }

    const { error: updateError } = await supabase.from("manutencoes").update(updates).eq("id", ordem.id);

    // Ao concluir uma manutenção com fornecedor, gera automaticamente a
    // avaliação dele (entra no ranking de Fornecedores) — sem isso não dá
    // pra montar o histórico de qualidade/prazo/custo/atendimento.
    if (!updateError && vaiConcluir && gerenciarForm.fornecedorId) {
      const a = gerenciarForm.avaliacao;
      const { error: avaliacaoError } = await supabase.from("avaliacoes_fornecedor").insert({
        condominio_id: condominio.id,
        fornecedor_id: gerenciarForm.fornecedorId,
        manutencao_id: ordem.id,
        avaliador_id: user?.id || null,
        avaliador_nome: nomeUsuario,
        nota_qualidade: a.nota_qualidade,
        nota_prazo: a.nota_prazo,
        nota_custo: a.nota_custo,
        nota_atendimento: a.nota_atendimento,
        observacao: a.observacao.trim() || null,
      });
      if (avaliacaoError) console.error("Erro ao registrar avaliação do fornecedor:", avaliacaoError.message);
    }

    setSalvando(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setGerenciandoId(null);
    setGerenciarForm(null);
    load();
  }

  async function handleProgramarProxima(ordem) {
    setProgramandoId(ordem.id);
    setError("");
    const base = ordem.concluido_em ? ordem.concluido_em.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const proximaData = calcularProximaData(ordem.periodicidade, ordem.periodicidade_dias, base);
    const { error: insertError } = await supabase.from("manutencoes").insert({
      condominio_id: condominio.id,
      titulo: ordem.titulo,
      descricao: ordem.descricao,
      unidade: ordem.unidade,
      categoria: ordem.categoria,
      tipo: "recorrente",
      periodicidade: ordem.periodicidade,
      periodicidade_dias: ordem.periodicidade_dias,
      data_prevista: proximaData,
      fornecedor_id: ordem.fornecedor_id,
      fornecedor_nome: ordem.fornecedor_nome,
      responsavel_colaborador_id: ordem.responsavel_colaborador_id,
      status: "aberta",
      ciclo_origem_id: ordem.id,
    });
    setProgramandoId(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    load();
  }

  function solicitarProposta(ordem) {
    const params = new URLSearchParams({
      manutencaoId: ordem.id,
      titulo: ordem.titulo,
      descricao: ordem.descricao || "",
    });
    router.push(`/dashboard/propostas?${params.toString()}`);
  }

  const colaboradorPorId = useMemo(() => {
    const mapa = {};
    for (const c of colaboradores) mapa[c.id] = c;
    return mapa;
  }, [colaboradores]);

  const proximosCiclosGerados = useMemo(() => {
    const set = new Set();
    for (const o of ordens) if (o.ciclo_origem_id) set.add(o.ciclo_origem_id);
    return set;
  }, [ordens]);

  const grupos = useMemo(() => {
    const atrasadas = [];
    const proximas = [];
    const demais = [];
    const concluidas = [];
    for (const o of ordens) {
      if (o.status === "concluida") {
        concluidas.push(o);
        continue;
      }
      const prazo = calcularStatusPrazo(o.data_prevista, o.status, STATUS_FINAIS);
      if (prazo?.nivel === "vermelho") atrasadas.push(o);
      else if (prazo?.nivel === "amarelo") proximas.push(o);
      else demais.push(o);
    }
    return { atrasadas, proximas, demais, concluidas };
  }, [ordens]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  function Cartao(o) {
    const prazo = calcularStatusPrazo(o.data_prevista, o.status, STATUS_FINAIS);
    const jaGerouProximo = proximosCiclosGerados.has(o.id);
    return (
      <div key={o.id} className="card">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-navy-900">{o.titulo}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[o.status]}`}>
            {STATUS_LABELS[o.status]}
          </span>
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
            {TIPO_LABELS[o.tipo] || TIPO_LABELS.avulsa}
          </span>
          {o.tipo === "recorrente" && o.periodicidade && (
            <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
              {PERIODICIDADE_LABELS[o.periodicidade]}
            </span>
          )}
          {prazo && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRAZO_BADGE_STYLES[prazo.nivel]}`}>
              {prazo.emoji} {prazo.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-navy-400">
          {[o.categoria, o.unidade, o.fornecedor_nome, colaboradorPorId[o.responsavel_colaborador_id]?.nome]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {o.descricao && <p className="mt-2 text-sm text-navy-600">{o.descricao}</p>}
        <p className="mt-2 text-xs text-navy-400">
          Aberta em {new Date(o.created_at).toLocaleDateString("pt-BR")}
          {o.data_prevista && <> · Prevista para {new Date(`${o.data_prevista}T00:00:00`).toLocaleDateString("pt-BR")}</>}
          {o.concluido_em && (
            <>
              {" "}
              · Concluída em {new Date(o.concluido_em).toLocaleString("pt-BR")}
              {o.concluido_por_nome && <> por {o.concluido_por_nome}</>}
            </>
          )}
          {o.chamado_origem_id && " · Vinculada a um chamado"}
        </p>
        {o.resultado && (
          <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">
            <strong>Resultado:</strong> {o.resultado}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-3">
          {podeEditar && gerenciandoId !== o.id && (
            <button onClick={() => abrirGerenciamento(o)} className="text-xs font-semibold text-navy-700 hover:underline">
              Gerenciar
            </button>
          )}
          {podeSolicitarProposta && (
            <button onClick={() => solicitarProposta(o)} className="text-xs font-semibold text-navy-700 hover:underline">
              Solicitar proposta
            </button>
          )}
          {podeEditar && o.status === "concluida" && o.tipo === "recorrente" && o.periodicidade && !jaGerouProximo && (
            <button
              onClick={() => handleProgramarProxima(o)}
              disabled={programandoId === o.id}
              className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50"
            >
              {programandoId === o.id ? "Programando..." : "Programar próxima manutenção"}
            </button>
          )}
        </div>

        {gerenciandoId === o.id && gerenciarForm && (
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
              {fornecedores.length > 0 && (
                <div>
                  <label className="label-field">Fornecedor</label>
                  <select
                    className="input-field"
                    value={gerenciarForm.fornecedorId}
                    onChange={(e) => setGerenciarForm((f) => ({ ...f, fornecedorId: e.target.value }))}
                  >
                    <option value="">Sem fornecedor</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.razao_social}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {colaboradores.length > 0 && (
                <div>
                  <label className="label-field">Colaborador responsável</label>
                  <select
                    className="input-field"
                    value={gerenciarForm.colaboradorId}
                    onChange={(e) => setGerenciarForm((f) => ({ ...f, colaboradorId: e.target.value }))}
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
            </div>
            {gerenciarForm.status === "concluida" && (
              <div>
                <label className="label-field">Resultado</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={gerenciarForm.resultado}
                  onChange={(e) => setGerenciarForm((f) => ({ ...f, resultado: e.target.value }))}
                  placeholder="O que foi feito"
                />
              </div>
            )}
            {gerenciarForm.status === "concluida" && o.status !== "concluida" && gerenciarForm.fornecedorId && (
              <div className="rounded-lg bg-navy-50/50 p-3">
                <p className="text-sm font-semibold text-navy-800">Avalie o fornecedor</p>
                <p className="text-xs text-navy-500">Entra no histórico e no ranking de Fornecedores.</p>
                <div className="mt-2 space-y-1.5">
                  {CRITERIOS_AVALIACAO.map((c) => (
                    <div key={c.chave} className="flex items-center justify-between">
                      <span className="text-sm text-navy-600">{c.label}</span>
                      <Estrelas
                        nota={gerenciarForm.avaliacao[c.chave]}
                        onChange={(nota) =>
                          setGerenciarForm((f) => ({ ...f, avaliacao: { ...f.avaliacao, [c.chave]: nota } }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  className="input-field mt-2"
                  rows={2}
                  placeholder="Observação (opcional)"
                  value={gerenciarForm.avaliacao.observacao}
                  onChange={(e) =>
                    setGerenciarForm((f) => ({ ...f, avaliacao: { ...f.avaliacao, observacao: e.target.value } }))
                  }
                />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => handleSalvarGerenciamento(o)} disabled={salvando} className="btn-primary text-sm">
                {salvando ? "Salvando..." : "Salvar"}
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
      </div>
    );
  }

  return (
    <ModuloGuard modulo="manutencao">
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Manutenção</h1>
        <p className="mt-1 text-sm text-navy-500">
          Ordens avulsas, preventivas ou recorrentes: reparos, limpeza e manutenção programada.
        </p>

        {podeCriar && (
          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label-field">Título</label>
              <input
                className="input-field"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Troca de lâmpada do hall"
                required
              />
            </div>
            <div>
              <label className="label-field">Categoria (opcional)</label>
              <input
                className="input-field"
                list="categorias-manutencao"
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              />
              <datalist id="categorias-manutencao">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label-field">Unidade / Local (opcional)</label>
              <input
                className="input-field"
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                placeholder="Ex: Bloco B, térreo"
              />
            </div>
            <div>
              <label className="label-field">Tipo</label>
              <select
                className="input-field"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                <option value="avulsa">{TIPO_LABELS.avulsa}</option>
                <option value="preventiva">{TIPO_LABELS.preventiva}</option>
                <option value="recorrente">{TIPO_LABELS.recorrente}</option>
              </select>
            </div>
            <div>
              <label className="label-field">Data prevista (opcional)</label>
              <input
                type="date"
                className="input-field"
                value={form.dataPrevista}
                onChange={(e) => setForm((f) => ({ ...f, dataPrevista: e.target.value }))}
              />
            </div>
            {form.tipo === "recorrente" && (
              <>
                <div>
                  <label className="label-field">Periodicidade</label>
                  <select
                    className="input-field"
                    value={form.periodicidade}
                    onChange={(e) => setForm((f) => ({ ...f, periodicidade: e.target.value }))}
                  >
                    {Object.entries(PERIODICIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {form.periodicidade === "personalizada" && (
                  <div>
                    <label className="label-field">A cada quantos dias</label>
                    <input
                      type="number"
                      className="input-field"
                      value={form.periodicidadeDias}
                      onChange={(e) => setForm((f) => ({ ...f, periodicidadeDias: e.target.value }))}
                      placeholder="Ex: 45"
                    />
                  </div>
                )}
              </>
            )}
            {fornecedores.length > 0 && (
              <div>
                <label className="label-field">Fornecedor (opcional)</label>
                <select
                  className="input-field"
                  value={form.fornecedorId}
                  onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}
                >
                  <option value="">Sem fornecedor</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.razao_social}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {colaboradores.length > 0 && (
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
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Criando..." : "Nova ordem de serviço"}
              </button>
            </div>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando ordens de serviço...</p>
      ) : ordens.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhuma ordem de serviço ainda.</div>
      ) : (
        <div className="space-y-6">
          {grupos.atrasadas.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-coral-700">Atrasadas ({grupos.atrasadas.length})</h2>
              <div className="space-y-3">{grupos.atrasadas.map((o) => Cartao(o))}</div>
            </div>
          )}
          {grupos.proximas.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-amber-700">Próximas ({grupos.proximas.length})</h2>
              <div className="space-y-3">{grupos.proximas.map((o) => Cartao(o))}</div>
            </div>
          )}
          {grupos.demais.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-navy-700">Em aberto ({grupos.demais.length})</h2>
              <div className="space-y-3">{grupos.demais.map((o) => Cartao(o))}</div>
            </div>
          )}
          {grupos.concluidas.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-emerald-700">Concluídas ({grupos.concluidas.length})</h2>
              <div className="space-y-3">{grupos.concluidas.map((o) => Cartao(o))}</div>
            </div>
          )}
        </div>
      )}
    </div>
    </ModuloGuard>
  );
}
