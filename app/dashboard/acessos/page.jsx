"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/adminFetch";
import { ALL_MODULOS, DEFAULT_MODULOS_BY_PAPEL, MODULO_LABELS } from "@/lib/modulos";

const PAPEL_LABELS = {
  condomino: "Condômino",
  porteiro: "Porteiro",
  conselheiro: "Conselheiro",
  zelador: "Zelador",
};

// O que cada papel enxerga no sistema. Fixo no código por enquanto — não é
// customizável pelo síndico (ver README para o motivo dessa decisão).
const ROLE_OVERVIEW = [
  {
    papel: "sindico",
    label: "Síndico (você)",
    description: "Acesso total: todos os módulos, todos os dados do condomínio.",
    modulos: ["Visão geral", "Boletos*", "Chamados", "Avisos", "Ocorrências", "Manutenção", "Propostas", "Acessos", "Configurações"],
  },
  {
    papel: "condomino",
    label: "Condômino",
    description: "Só consulta avisos publicados pelo síndico.",
    modulos: ["Avisos (leitura)"],
  },
  {
    papel: "porteiro",
    label: "Porteiro",
    description: "Registra e consulta o livro de ocorrências da portaria.",
    modulos: ["Ocorrências"],
  },
  {
    papel: "zelador",
    label: "Zelador",
    description: "Gerencia ordens de manutenção e também registra ocorrências.",
    modulos: ["Manutenção", "Ocorrências"],
  },
  {
    papel: "conselheiro",
    label: "Conselheiro",
    description: "Avalia e aprova/reprova propostas comerciais cadastradas pelo síndico.",
    modulos: ["Propostas"],
  },
];

const emptyForm = {
  nome: "",
  email: "",
  telefone: "",
  password: "",
  papel: "condomino",
  unidade: "",
  modulos: DEFAULT_MODULOS_BY_PAPEL.condomino,
};

// Random 8-char temporary password (letters + digits) for password resets.
function generateTempPassword() {
  return Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4);
}

function toggleModulo(modulos, chave) {
  return modulos.includes(chave) ? modulos.filter((m) => m !== chave) : [...modulos, chave];
}

// Marca/desmarca módulos: usado tanto no formulário de criação quanto no
// modal de edição, então recebe o array atual + o setter do form que o
// chama (setForm ou setEditForm).
function ModulosCheckboxes({ modulos, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {ALL_MODULOS.map((chave) => (
        <label key={chave} className="flex items-center gap-1.5 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={modulos.includes(chave)}
            onChange={() => onChange(toggleModulo(modulos, chave))}
            className="h-4 w-4 rounded border-navy-300 text-coral focus:ring-coral"
          />
          {MODULO_LABELS[chave]}
        </label>
      ))}
    </div>
  );
}

export default function AcessosPage() {
  const { condominio } = useAuth();
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [lastCreated, setLastCreated] = useState(null);
  const [lastReset, setLastReset] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("membros")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setMembros(data || []);
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
    try {
      const res = await authedFetch("/api/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, condominioId: condominio.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar acesso.");
      setLastCreated({ nome: form.nome, loginEmail: json.loginEmail, generated: !form.email.trim() });
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
      modulos: membro.modulos && membro.modulos.length > 0 ? membro.modulos : [],
    });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setSavingEdit(true);
    setError("");
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

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  const countByPapel = (papel) =>
    papel === "sindico" ? 1 : membros.filter((m) => m.papel === papel).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Acessos</h1>
        <p className="mt-1 text-sm text-navy-500">
          Quem vê o quê no seu condomínio — cada papel entra com os módulos padrão listados
          abaixo, mas você pode marcar/desmarcar módulos avulsos por pessoa ao criar ou editar um
          acesso.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_OVERVIEW.map((r) => (
          <div key={r.papel} className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-navy-900">{r.label}</h3>
              <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600">
                {countByPapel(r.papel)} {countByPapel(r.papel) === 1 ? "pessoa" : "pessoas"}
              </span>
            </div>
            <p className="mt-1 text-sm text-navy-500">{r.description}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {r.modulos.map((m) => (
                <li
                  key={m}
                  className="rounded-full bg-coral-50 px-2 py-0.5 text-xs font-medium text-coral-700"
                >
                  {m}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-navy-400">
        * Boletos ainda é um módulo em construção (depende de integração bancária).
      </p>

      <div className="card">
        <h2 className="font-display text-lg font-bold text-navy-900">Criar novo acesso</h2>
        <p className="mt-1 text-sm text-navy-500">
          Crie contas com acesso delimitado: condômino (só avisos, por enquanto), porteiro
          (ocorrências), conselheiro (propostas comerciais) ou zelador (manutenção e
          ocorrências).
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
                setForm((f) => ({ ...f, papel, modulos: DEFAULT_MODULOS_BY_PAPEL[papel] || [] }));
              }}
            >
              <option value="condomino">Condômino</option>
              <option value="porteiro">Porteiro</option>
              <option value="conselheiro">Conselheiro</option>
              <option value="zelador">Zelador</option>
            </select>
          </div>
          {form.papel === "condomino" && (
            <div>
              <label className="label-field">Unidade</label>
              <input
                className="input-field"
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                placeholder="Ex: Apto 32"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label-field">
              Módulos que essa pessoa vai ver (o papel já marca um padrão — desmarque ou marque
              mais se quiser)
            </label>
            <ModulosCheckboxes
              modulos={form.modulos}
              onChange={(modulos) => setForm((f) => ({ ...f, modulos }))}
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
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/50 text-left text-navy-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Login (e-mail)</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Módulos</th>
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
                    {m.modulos && m.modulos.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {m.modulos.map((mod) => (
                          <span
                            key={mod}
                            className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600"
                          >
                            {MODULO_LABELS[mod] || mod}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-navy-400">Nenhum</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy-600">{m.unidade || "-"}</td>
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
      )}

      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
          <div className="card w-full max-w-md">
            <h2 className="font-display text-lg font-bold text-navy-900">
              Editar acesso de {editing.nome}
            </h2>
            <p className="mt-1 text-sm text-navy-500">
              Altere o papel, a unidade ou o telefone. Login (e-mail) e senha não mudam aqui — use
              &quot;Redefinir senha&quot; para gerar uma nova senha.
            </p>

            <form onSubmit={handleEditSave} className="mt-4 space-y-3">
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
                  <option value="condomino">Condômino</option>
                  <option value="porteiro">Porteiro</option>
                  <option value="conselheiro">Conselheiro</option>
                  <option value="zelador">Zelador</option>
                </select>
              </div>
              {editForm.papel === "condomino" && (
                <div>
                  <label className="label-field">Unidade</label>
                  <input
                    className="input-field"
                    value={editForm.unidade}
                    onChange={(e) => setEditForm((f) => ({ ...f, unidade: e.target.value }))}
                    placeholder="Ex: Apto 32"
                  />
                </div>
              )}
              <div>
                <label className="label-field">Módulos que essa pessoa vê</label>
                <ModulosCheckboxes
                  modulos={editForm.modulos}
                  onChange={(modulos) => setEditForm((f) => ({ ...f, modulos }))}
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
  );
}
