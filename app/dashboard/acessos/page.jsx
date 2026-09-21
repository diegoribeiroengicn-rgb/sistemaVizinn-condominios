"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/adminFetch";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";
import {
  ACOES,
  ACAO_LABELS,
  ACOES_POR_MODULO,
  ALL_MODULOS,
  DEFAULT_PERMISSOES_BY_PAPEL,
  MODULO_LABELS,
  PAPEL_LABELS,
  papelPodeRequererAprovacao,
} from "@/lib/permissoes";

const emptyForm = {
  nome: "",
  email: "",
  telefone: "",
  password: "",
  papel: "condomino",
  unidade: "",
  bloco: "",
  permissoes: DEFAULT_PERMISSOES_BY_PAPEL.condomino,
  requerAprovacao: true,
};

// Random 8-char temporary password (letters + digits) for password resets.
function generateTempPassword() {
  return Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4);
}

function togglePermissao(permissoes, modulo, acao) {
  const atuais = permissoes[modulo] || [];
  const novos = atuais.includes(acao) ? atuais.filter((a) => a !== acao) : [...atuais, acao];
  const novo = { ...permissoes };
  if (novos.length > 0) novo[modulo] = novos;
  else delete novo[modulo];
  return novo;
}

// Grade de módulo x ação — usado tanto no formulário de criação quanto no
// modal de edição. Só mostra checkbox pras ações que fazem sentido pra
// cada módulo (ACOES_POR_MODULO); o resto fica "—".
function PermissoesEditor({ permissoes, onChange }) {
  return (
    <>
      {/* Telas pequenas: um bloco por módulo, ações lado a lado sem rolagem lateral. */}
      <div className="space-y-2 md:hidden">
        {ALL_MODULOS.map((modulo) => {
          const acoesDisponiveis = ACOES_POR_MODULO[modulo] || [];
          if (acoesDisponiveis.length === 0) return null;
          return (
            <div key={modulo} className="rounded-xl border border-navy-100 p-3">
              <p className="text-sm font-medium text-navy-800">{MODULO_LABELS[modulo]}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {acoesDisponiveis.map((acao) => (
                  <label key={acao} className="flex items-center gap-1.5 text-xs text-navy-600">
                    <input
                      type="checkbox"
                      checked={(permissoes[modulo] || []).includes(acao)}
                      onChange={() => onChange(togglePermissao(permissoes, modulo, acao))}
                      className="h-4 w-4 rounded border-navy-300 text-coral focus:ring-coral"
                    />
                    {ACAO_LABELS[acao]}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Telas médias e grandes: grade completa módulo x ação. */}
      <div className="hidden rounded-xl border border-navy-100 md:block">
        <table className="w-full text-sm">
          <thead className="bg-navy-50/50 text-left text-navy-500">
            <tr>
              <th className="px-3 py-2 font-medium">Módulo</th>
              {ACOES.map((acao) => (
                <th key={acao} className="px-3 py-2 text-center font-medium">
                  {ACAO_LABELS[acao]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_MODULOS.map((modulo) => (
              <tr key={modulo} className="border-t border-navy-50">
                <td className="px-3 py-2 font-medium text-navy-800">{MODULO_LABELS[modulo]}</td>
                {ACOES.map((acao) => {
                  const disponivel = (ACOES_POR_MODULO[modulo] || []).includes(acao);
                  return (
                    <td key={acao} className="px-3 py-2 text-center">
                      {disponivel ? (
                        <input
                          type="checkbox"
                          checked={(permissoes[modulo] || []).includes(acao)}
                          onChange={() => onChange(togglePermissao(permissoes, modulo, acao))}
                          className="h-4 w-4 rounded border-navy-300 text-coral focus:ring-coral"
                        />
                      ) : (
                        <span className="text-navy-200">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function resumoPermissoes(permissoes) {
  return Object.entries(permissoes || {}).filter(([, acoes]) => acoes?.length > 0);
}

const PENDENCIA_ACAO_LABELS = { criar: "Criar acesso", editar: "Editar acesso", excluir: "Excluir acesso" };

export default function AcessosPage() {
  const { condominio, role } = useAuth();
  const [membros, setMembros] = useState([]);
  const [pendencias, setPendencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [decidindoId, setDecidindoId] = useState(null);
  const [lastCreated, setLastCreated] = useState(null);
  const [lastReset, setLastReset] = useState(null);
  const [lastPending, setLastPending] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const [membrosResult, pendenciasResult] = await Promise.all([
      supabase
        .from("membros")
        .select("*")
        .eq("condominio_id", condominio.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("pendencias")
        .select("*")
        .eq("condominio_id", condominio.id)
        .order("created_at", { ascending: false }),
    ]);
    if (membrosResult.error) setError(membrosResult.error.message);
    else setMembros(membrosResult.data || []);
    if (pendenciasResult.error) console.error("Erro ao buscar pendências:", pendenciasResult.error.message);
    else setPendencias(pendenciasResult.data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id) return;

    if (!form.email.trim() && !form.telefone.trim()) {
      setError("Informe pelo menos um telefone ou e-mail.");
      return;
    }

    setSubmitting(true);
    setError("");
    setLastCreated(null);
    setLastPending(null);
    try {
      const res = await authedFetch("/api/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, condominioId: condominio.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar acesso.");
      if (json.pending) {
        setLastPending({ nome: form.nome, acao: "criar" });
      } else {
        setLastCreated({ nome: form.nome, loginEmail: json.loginEmail, generated: !form.email.trim() });
      }
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(membro) {
    if (!confirm(`Remover o acesso de "${membro.nome}"? A conta de login dele será excluída.`)) return;
    setRemovingId(membro.id);
    setLastPending(null);
    try {
      const res = await authedFetch("/api/members/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominio.id,
          memberId: membro.id,
          userId: membro.user_id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao remover acesso.");
      if (json.pending) setLastPending({ nome: membro.nome, acao: "excluir" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  function openEdit(membro) {
    setError("");
    setEditing(membro);
    setEditForm({
      nome: membro.nome,
      telefone: membro.telefone || "",
      papel: membro.papel,
      unidade: membro.unidade || "",
      bloco: membro.bloco || "",
      permissoes: membro.permissoes || {},
      requerAprovacao: membro.requer_aprovacao,
    });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setSavingEdit(true);
    setError("");
    setLastPending(null);
    try {
      const res = await authedFetch("/api/members/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominio.id,
          memberId: editing.id,
          ...editForm,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao editar acesso.");
      if (json.pending) setLastPending({ nome: editForm.nome, acao: "editar" });
      setEditing(null);
      setEditForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleResetPassword(membro) {
    if (!confirm(`Gerar uma nova senha temporária para "${membro.nome}"?`)) return;
    setResettingId(membro.id);
    setError("");
    setLastReset(null);
    const newPassword = generateTempPassword();
    try {
      const res = await authedFetch("/api/members/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominio.id,
          memberId: membro.id,
          userId: membro.user_id,
          newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao redefinir senha.");
      setLastReset({ nome: membro.nome, loginEmail: membro.email, newPassword });
    } catch (err) {
      setError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  async function handleDecidirPendencia(pendencia, decisao) {
    let motivoRejeicao;
    if (decisao === "rejeitar") {
      motivoRejeicao = window.prompt("Motivo da rejeição (opcional):") || "";
    }
    if (!confirm(`Confirma ${decisao === "aprovar" ? "aprovar" : "rejeitar"} esta solicitação?`)) return;
    setDecidindoId(pendencia.id);
    setError("");
    try {
      const res = await authedFetch("/api/pendencias/decidir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominio.id,
          pendenciaId: pendencia.id,
          decisao,
          motivoRejeicao,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao decidir pendência.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDecidindoId(null);
    }
  }

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  const countByPapel = (papel) =>
    papel === "sindico" ? 1 : membros.filter((m) => m.papel === papel).length;

  const pendenciasAbertas = pendencias.filter((p) => p.status === "pendente");
  const isSindico = role === "sindico";

  return (
    <ModuloGuard modulo="acessos">
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Acessos</h1>
        <p className="mt-1 text-sm text-navy-500">
          Quem vê o quê no seu condomínio — cada papel entra com um conjunto padrão de permissões,
          mas você ajusta módulo a módulo, ação a ação, por pessoa.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-navy-900">Síndico (você)</h3>
            <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
              1 pessoa
            </span>
          </div>
          <p className="mt-1 text-sm text-navy-500">
            Acesso total: todos os módulos, todas as ações, todos os dados do condomínio.
          </p>
        </div>
        {Object.entries(PAPEL_LABELS).map(([papel, label]) => (
          <div key={papel} className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-navy-900">{label}</h3>
              <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                {countByPapel(papel)} {countByPapel(papel) === 1 ? "pessoa" : "pessoas"}
              </span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {resumoPermissoes(DEFAULT_PERMISSOES_BY_PAPEL[papel]).map(([modulo, acoes]) => (
                <li
                  key={modulo}
                  title={acoes.map((a) => ACAO_LABELS[a]).join(", ")}
                  className="rounded-full bg-coral-50 px-2 py-0.5 text-xs font-medium text-coral-700"
                >
                  {MODULO_LABELS[modulo]}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {isSindico && pendenciasAbertas.length > 0 && (
        <div className="card border-amber-200 bg-amber-50">
          <h2 className="font-display text-lg font-bold text-navy-900">
            Pendências de aprovação ({pendenciasAbertas.length})
          </h2>
          <div className="mt-3 space-y-3">
            {pendenciasAbertas.map((p) => (
              <div key={p.id} className="rounded-xl border border-amber-200 bg-white p-3">
                <p className="text-sm text-navy-800">
                  <strong>{p.solicitante_nome}</strong> quer{" "}
                  <strong>{PENDENCIA_ACAO_LABELS[p.acao] || p.acao}</strong> para{" "}
                  <strong>{p.dados_novos?.nome || p.dados_anteriores?.nome || "—"}</strong>.
                </p>
                <p className="mt-1 text-xs text-navy-400">
                  {new Date(p.created_at).toLocaleString("pt-BR")}
                </p>
                <div className="mt-2 flex gap-3">
                  <button
                    onClick={() => handleDecidirPendencia(p, "aprovar")}
                    disabled={decidindoId === p.id}
                    className="rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleDecidirPendencia(p, "rejeitar")}
                    disabled={decidindoId === p.id}
                    className="rounded-full border border-coral px-4 py-1 text-xs font-semibold text-coral hover:bg-coral hover:text-white disabled:opacity-50"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-display text-lg font-bold text-navy-900">Criar novo acesso</h2>
        <p className="mt-1 text-sm text-navy-500">
          Condômino, porteiro, conselheiro, zelador, subsíndico ou administrador (pode representar
          uma administradora externa).
        </p>

        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field">Nome</label>
            <input
              className="input-field"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label-field">Telefone</label>
            <input
              className="input-field"
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <label className="label-field">E-mail (opcional)</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Deixe em branco se só tiver telefone"
            />
          </div>
          <div>
            <label className="label-field">Senha inicial</label>
            <input
              type="password"
              className="input-field"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>
          <div>
            <label className="label-field">Papel</label>
            <select
              className="input-field"
              value={form.papel}
              onChange={(e) => {
                const papel = e.target.value;
                setForm((f) => ({
                  ...f,
                  papel,
                  permissoes: DEFAULT_PERMISSOES_BY_PAPEL[papel] || {},
                  requerAprovacao: papelPodeRequererAprovacao(papel) ? true : false,
                }));
              }}
            >
              {Object.entries(PAPEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {form.papel === "condomino" && (
            <>
              <div>
                <label className="label-field">Unidade (apartamento)</label>
                <input
                  className="input-field"
                  value={form.unidade}
                  onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                  placeholder="Ex: 32"
                />
              </div>
              <div>
                <label className="label-field">Bloco</label>
                <input
                  className="input-field"
                  value={form.bloco}
                  onChange={(e) => setForm((f) => ({ ...f, bloco: e.target.value }))}
                  placeholder="Ex: B"
                />
              </div>
            </>
          )}
          {papelPodeRequererAprovacao(form.papel) && (
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-navy-700">
                <input
                  type="checkbox"
                  checked={form.requerAprovacao}
                  onChange={(e) => setForm((f) => ({ ...f, requerAprovacao: e.target.checked }))}
                  className="h-4 w-4 rounded border-navy-300 text-coral focus:ring-coral"
                />
                Alterações em Acessos feitas por essa pessoa precisam da sua aprovação
              </label>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label-field">
              Permissões (o papel já marca um padrão — ajuste módulo a módulo se quiser)
            </label>
            <PermissoesEditor
              permissoes={form.permissoes}
              onChange={(permissoes) => setForm((f) => ({ ...f, permissoes }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Criando..." : "Criar acesso"}
            </button>
          </div>
        </form>
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {lastPending && (
        <div className="card border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            Solicitação para {PENDENCIA_ACAO_LABELS[lastPending.acao]?.toLowerCase()} de{" "}
            <strong>{lastPending.nome}</strong> enviada — aguardando aprovação do síndico.
          </p>
        </div>
      )}

      {lastCreated && (
        <div className="card border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            Acesso de <strong>{lastCreated.nome}</strong> criado.
            {lastCreated.generated ? (
              <>
                {" "}
                Como não foi informado e-mail, o login gerado foi{" "}
                <strong>{lastCreated.loginEmail}</strong> — repasse esse e-mail junto com a
                senha pra pessoa conseguir entrar.
              </>
            ) : (
              <> Login: {lastCreated.loginEmail}.</>
            )}
          </p>
        </div>
      )}

      {lastReset && (
        <div className="card border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            Nova senha temporária para <strong>{lastReset.nome}</strong> ({lastReset.loginEmail}
            ): <strong className="font-mono">{lastReset.newPassword}</strong> — repasse pra
            pessoa entrar de novo.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-navy-500">Carregando acessos...</p>
      ) : membros.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum acesso delimitado criado ainda.</div>
      ) : (
        <>
          {/* Telas pequenas: um card por acesso, sem rolagem lateral. */}
          <div className="space-y-3 md:hidden">
            {membros.map((m) => (
              <div key={m.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy-900">{m.nome}</p>
                    <p className="text-xs text-navy-500">{PAPEL_LABELS[m.papel]}</p>
                  </div>
                </div>
                <dl className="mt-2 space-y-1 text-xs text-navy-600">
                  <div>
                    <dt className="text-navy-400">Login (e-mail)</dt>
                    <dd>{m.email}</dd>
                  </div>
                  {m.telefone && (
                    <div>
                      <dt className="text-navy-400">Telefone</dt>
                      <dd>{m.telefone}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-navy-400">Unidade</dt>
                    <dd>
                      {[m.bloco && `Bloco ${m.bloco}`, m.unidade && `Apto ${m.unidade}`]
                        .filter(Boolean)
                        .join(" — ") || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-navy-400">Aprovação</dt>
                    <dd>
                      {papelPodeRequererAprovacao(m.papel)
                        ? m.requer_aprovacao
                          ? "Precisa aprovar"
                          : "Livre"
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-navy-400">Permissões</dt>
                    <dd>
                      {resumoPermissoes(m.permissoes).length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {resumoPermissoes(m.permissoes).map(([modulo, acoes]) => (
                            <span
                              key={modulo}
                              title={acoes.map((a) => ACAO_LABELS[a]).join(", ")}
                              className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600"
                            >
                              {MODULO_LABELS[modulo]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "Nenhuma"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    onClick={() => openEdit(m)}
                    className="text-xs font-semibold text-navy-700 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleResetPassword(m)}
                    disabled={resettingId === m.id}
                    className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50"
                  >
                    {resettingId === m.id ? "Gerando..." : "Redefinir senha"}
                  </button>
                  <button
                    onClick={() => handleRemove(m)}
                    disabled={removingId === m.id}
                    className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                  >
                    {removingId === m.id ? "Removendo..." : "Remover acesso"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Telas médias e grandes: tabela completa. */}
          <div className="card hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-navy-100 bg-navy-50/50 text-left text-navy-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Login (e-mail)</th>
                  <th className="px-4 py-3 font-medium">Papel</th>
                  <th className="px-4 py-3 font-medium">Permissões</th>
                  <th className="px-4 py-3 font-medium">Aprovação</th>
                  <th className="px-4 py-3 font-medium">Unidade</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {membros.map((m) => (
                  <tr key={m.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-navy-900">{m.nome}</td>
                    <td className="px-4 py-3 text-navy-600">{m.telefone || "-"}</td>
                    <td className="px-4 py-3 text-navy-600">{m.email}</td>
                    <td className="px-4 py-3 text-navy-600">{PAPEL_LABELS[m.papel]}</td>
                    <td className="px-4 py-3">
                      {resumoPermissoes(m.permissoes).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {resumoPermissoes(m.permissoes).map(([modulo, acoes]) => (
                            <span
                              key={modulo}
                              title={acoes.map((a) => ACAO_LABELS[a]).join(", ")}
                              className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600"
                            >
                              {MODULO_LABELS[modulo]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-navy-400">Nenhuma</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-navy-600">
                      {papelPodeRequererAprovacao(m.papel)
                        ? m.requer_aprovacao
                          ? "Precisa aprovar"
                          : "Livre"
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-navy-600">
                      {[m.bloco && `Bloco ${m.bloco}`, m.unidade && `Apto ${m.unidade}`]
                        .filter(Boolean)
                        .join(" — ") || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-xs font-semibold text-navy-700 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleResetPassword(m)}
                          disabled={resettingId === m.id}
                          className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-50"
                        >
                          {resettingId === m.id ? "Gerando..." : "Redefinir senha"}
                        </button>
                        <button
                          onClick={() => handleRemove(m)}
                          disabled={removingId === m.id}
                          className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                        >
                          {removingId === m.id ? "Removendo..." : "Remover acesso"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isSindico && pendencias.length > 0 && (
        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-900">Minhas solicitações</h2>
          <div className="mt-3 space-y-2">
            {pendencias.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-navy-100 p-3 text-sm">
                <span>
                  {PENDENCIA_ACAO_LABELS[p.acao] || p.acao} —{" "}
                  {p.dados_novos?.nome || p.dados_anteriores?.nome || "—"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "pendente"
                      ? "bg-amber-100 text-amber-700"
                      : p.status === "aprovada"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-coral-100 text-coral-700"
                  }`}
                >
                  {p.status === "pendente" ? "Pendente" : p.status === "aprovada" ? "Aprovada" : "Rejeitada"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-midnight/40 p-4">
          <div className="card w-full max-w-2xl">
            <h2 className="font-display text-lg font-bold text-navy-900">
              Editar acesso de {editing.nome}
            </h2>
            <p className="mt-1 text-sm text-navy-500">
              Altere o papel, a unidade, o telefone ou as permissões. Login (e-mail) e senha não
              mudam aqui — use &quot;Redefinir senha&quot; para gerar uma nova senha.
            </p>

            <form onSubmit={handleEditSave} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-field">Nome</label>
                  <input
                    className="input-field"
                    value={editForm.nome}
                    onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Telefone</label>
                  <input
                    className="input-field"
                    value={editForm.telefone}
                    onChange={(e) => setEditForm((f) => ({ ...f, telefone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="label-field">Papel</label>
                  <select
                    className="input-field"
                    value={editForm.papel}
                    onChange={(e) => setEditForm((f) => ({ ...f, papel: e.target.value }))}
                  >
                    {Object.entries(PAPEL_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {editForm.papel === "condomino" && (
                  <>
                    <div>
                      <label className="label-field">Unidade (apartamento)</label>
                      <input
                        className="input-field"
                        value={editForm.unidade}
                        onChange={(e) => setEditForm((f) => ({ ...f, unidade: e.target.value }))}
                        placeholder="Ex: 32"
                      />
                    </div>
                    <div>
                      <label className="label-field">Bloco</label>
                      <input
                        className="input-field"
                        value={editForm.bloco}
                        onChange={(e) => setEditForm((f) => ({ ...f, bloco: e.target.value }))}
                        placeholder="Ex: B"
                      />
                    </div>
                  </>
                )}
              </div>
              {papelPodeRequererAprovacao(editForm.papel) && (
                <label className="flex items-center gap-2 text-sm text-navy-700">
                  <input
                    type="checkbox"
                    checked={editForm.requerAprovacao}
                    onChange={(e) => setEditForm((f) => ({ ...f, requerAprovacao: e.target.checked }))}
                    className="h-4 w-4 rounded border-navy-300 text-coral focus:ring-coral"
                  />
                  Alterações em Acessos feitas por essa pessoa precisam da sua aprovação
                </label>
              )}
              <div>
                <label className="label-field">Permissões</label>
                <PermissoesEditor
                  permissoes={editForm.permissoes}
                  onChange={(permissoes) => setEditForm((f) => ({ ...f, permissoes }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingEdit} className="btn-primary">
                  {savingEdit ? "Salvando..." : "Salvar alterações"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setEditForm(null);
                  }}
                  className="text-sm font-semibold text-navy-500 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ModuloGuard>
  );
}
