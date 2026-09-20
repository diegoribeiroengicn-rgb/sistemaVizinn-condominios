"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";

const STATUS_LABELS = { pendente: "Pendente", aprovada: "Aprovada", reprovada: "Reprovada" };
const STATUS_STYLES = {
  pendente: "bg-amber-100 text-amber-700",
  aprovada: "bg-emerald-100 text-emerald-700",
  reprovada: "bg-coral-100 text-coral-700",
};

const emptyForm = { titulo: "", descricao: "", valor: "" };

export default function PropostasPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [propostas, setPropostas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState(null);

  // Pré-preenche quando chega vindo de "Solicitar proposta" numa
  // manutenção (?manutencaoId=...&titulo=...&descricao=...).
  useEffect(() => {
    const manutencaoId = searchParams.get("manutencaoId");
    if (!manutencaoId) return;
    setForm((f) => ({
      ...f,
      titulo: searchParams.get("titulo") || f.titulo,
      descricao: searchParams.get("descricao") || f.descricao,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quem cadastra e quem decide (aprova/reprova) agora é definido pela
  // permissão de cada pessoa nesse módulo, não mais fixo pro síndico ou
  // pro papel "conselheiro" — o síndico continua sempre podendo os dois.
  const podeCriar = temPermissao("propostas", "criar");
  const podeDecidir = temPermissao("propostas", "aprovar");
  const decisor = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("propostas")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setPropostas(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id || !form.titulo.trim()) return;

    setSubmitting(true);
    setError("");
    const manutencaoId = searchParams.get("manutencaoId") || null;
    const { error: insertError } = await supabase.from("propostas").insert({
      condominio_id: condominio.id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      valor: form.valor ? Number(form.valor) : null,
      status: "pendente",
      manutencao_origem_id: manutencaoId,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    if (manutencaoId) router.replace("/dashboard/propostas");
    load();
  }

  async function handleDecide(proposta, status) {
    setDecidingId(proposta.id);
    const { error: updateError } = await supabase
      .from("propostas")
      .update({
        status,
        decidido_por: decisor,
        decidido_em: new Date().toISOString(),
      })
      .eq("id", proposta.id);
    setDecidingId(null);
    if (updateError) setError(updateError.message);
    else load();
  }

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="propostas">
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Propostas comerciais</h1>
        <p className="mt-1 text-sm text-navy-500">
          {podeCriar
            ? "Cadastre propostas para o conselho avaliar."
            : "Avalie as propostas comerciais pendentes."}
        </p>

        {podeCriar && (
          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label-field">Título</label>
              <input
                className="input-field"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Troca do sistema de câmeras"
                required
              />
            </div>
            <div>
              <label className="label-field">Valor estimado (opcional)</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
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
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Enviando..." : "Nova proposta"}
              </button>
            </div>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando propostas...</p>
      ) : propostas.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhuma proposta cadastrada ainda.</div>
      ) : (
        <div className="space-y-3">
          {propostas.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-navy-900">{p.titulo}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}
                    >
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  {p.valor != null && (
                    <p className="mt-1 text-sm text-navy-600">
                      Valor estimado:{" "}
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        p.valor
                      )}
                    </p>
                  )}
                  {p.descricao && <p className="mt-2 text-sm text-navy-600">{p.descricao}</p>}
                  <p className="mt-2 text-xs text-navy-400">
                    Criada em {new Date(p.created_at).toLocaleString("pt-BR")}
                    {p.manutencao_origem_id && " · Vinculada a uma manutenção"}
                    {p.decidido_por && p.status !== "pendente" && (
                      <>
                        {" · "}
                        {STATUS_LABELS[p.status]} por {p.decidido_por} em{" "}
                        {new Date(p.decidido_em).toLocaleString("pt-BR")}
                      </>
                    )}
                  </p>
                </div>

                {p.status === "pendente" && podeDecidir && (
                  <div className="flex flex-none flex-col gap-2">
                    <button
                      onClick={() => handleDecide(p, "aprovada")}
                      disabled={decidingId === p.id}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleDecide(p, "reprovada")}
                      disabled={decidingId === p.id}
                      className="rounded-full border border-coral px-4 py-1.5 text-sm font-semibold text-coral transition hover:bg-coral hover:text-white disabled:opacity-50"
                    >
                      Reprovar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </ModuloGuard>
  );
}
