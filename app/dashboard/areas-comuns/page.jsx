"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import BotaoExcluirComAuditoria from "@/components/BotaoExcluirComAuditoria";

const emptyArea = { nome: "", descricao: "", capacidade: "" };
const emptyReserva = {};

export default function AreasComunsPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const nomeUsuario = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";
  const [areas, setAreas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyArea);
  const [submitting, setSubmitting] = useState(false);
  const [reservaForm, setReservaForm] = useState(emptyReserva);
  const [reservando, setReservando] = useState(null);
  const [cancelando, setCancelando] = useState(null);

  const podeGerenciar = temPermissao("areas_comuns", "editar");
  const podeReservar = temPermissao("areas_comuns", "criar");

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const [a, r] = await Promise.all([
      supabase.from("areas_comuns").select("*").eq("condominio_id", condominio.id).eq("ativo", true).order("nome"),
      supabase
        .from("reservas_areas")
        .select("*")
        .eq("condominio_id", condominio.id)
        .eq("status", "confirmada")
        .gte("data", new Date().toISOString().slice(0, 10))
        .order("data", { ascending: true }),
    ]);
    if (a.error) setError(a.error.message);
    else setAreas(a.data || []);
    if (!r.error) setReservas(r.data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateArea(e) {
    e.preventDefault();
    if (!condominio?.id || !form.nome.trim()) return;
    setSubmitting(true);
    setError("");
    const { error: insertError } = await supabase.from("areas_comuns").insert({
      condominio_id: condominio.id,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      capacidade: form.capacidade ? Number(form.capacidade) : null,
    });
    setSubmitting(false);
    if (insertError) return setError(insertError.message);
    setForm(emptyArea);
    load();
  }

  async function handleReservar(e, areaId) {
    e.preventDefault();
    const data = reservaForm[areaId];
    if (!data) return;
    setReservando(areaId);
    setError("");
    const { error: insertError } = await supabase.from("reservas_areas").insert({
      condominio_id: condominio.id,
      area_id: areaId,
      user_id: user.id,
      solicitante_nome: nomeUsuario,
      unidade: member?.unidade || null,
      data,
    });
    setReservando(null);
    if (insertError) {
      setError(insertError.message.includes("duplicate") ? "Essa data já está reservada pra esta área." : insertError.message);
      return;
    }
    setReservaForm((f) => ({ ...f, [areaId]: "" }));
    load();
  }

  async function handleCancelar(reserva) {
    setCancelando(reserva.id);
    const { error: updateError } = await supabase.from("reservas_areas").update({ status: "cancelada" }).eq("id", reserva.id);
    setCancelando(null);
    if (updateError) setError(updateError.message);
    else load();
  }

  if (!condominio) return <p className="text-navy-500">Carregando condomínio...</p>;

  return (
    <ModuloGuard modulo="areas_comuns">
      <div className="space-y-6">
        <div className="card">
          <h1 className="font-display text-xl font-bold text-navy-900">Áreas Comuns</h1>
          <p className="mt-1 text-sm text-navy-500">Reserve um dia pra usar o salão, a churrasqueira ou outro espaço do condomínio.</p>

          {podeGerenciar && (
            <form onSubmit={handleCreateArea} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="label-field">Nova área</label>
                <input
                  className="input-field"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Salão de festas"
                  required
                />
              </div>
              <div>
                <label className="label-field">Capacidade (opcional)</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={form.capacidade}
                  onChange={(e) => setForm((f) => ({ ...f, capacidade: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={submitting} className="btn-secondary w-full">
                  {submitting ? "Salvando..." : "Adicionar área"}
                </button>
              </div>
              <div className="sm:col-span-4">
                <label className="label-field">Regras/descrição (opcional)</label>
                <input
                  className="input-field"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: capacidade máxima 50 pessoas, silêncio após 22h"
                />
              </div>
            </form>
          )}
        </div>

        {error && <p className="text-sm text-coral-700">{error}</p>}

        {loading ? (
          <p className="text-navy-500">Carregando áreas...</p>
        ) : areas.length === 0 ? (
          <div className="card text-center text-navy-400">Nenhuma área comum cadastrada ainda.</div>
        ) : (
          <div className="space-y-4">
            {areas.map((area) => {
              const reservasDaArea = reservas.filter((r) => r.area_id === area.id);
              return (
                <div key={area.id} className="card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold text-navy-900">{area.nome}</h2>
                      {area.descricao && <p className="mt-1 text-sm text-navy-600">{area.descricao}</p>}
                      {area.capacidade && <p className="mt-1 text-xs text-navy-400">Capacidade: {area.capacidade} pessoas</p>}
                    </div>
                    {podeGerenciar && (
                      <BotaoExcluirComAuditoria
                        tabela="areas_comuns"
                        modulo="areas_comuns"
                        registroId={area.id}
                        descricao="esta área"
                        onExcluido={load}
                        className="flex-none text-xs font-semibold text-coral hover:underline"
                      />
                    )}
                  </div>

                  {podeReservar && (
                    <form onSubmit={(e) => handleReservar(e, area.id)} className="flex flex-wrap items-end gap-2 border-t border-navy-100 pt-3">
                      <div>
                        <label className="label-field">Reservar pra</label>
                        <input
                          type="date"
                          className="input-field w-auto"
                          min={new Date().toISOString().slice(0, 10)}
                          value={reservaForm[area.id] || ""}
                          onChange={(e) => setReservaForm((f) => ({ ...f, [area.id]: e.target.value }))}
                          required
                        />
                      </div>
                      <button type="submit" disabled={reservando === area.id} className="btn-primary text-sm">
                        {reservando === area.id ? "Reservando..." : "Reservar"}
                      </button>
                    </form>
                  )}

                  <div className="border-t border-navy-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Próximas reservas</p>
                    {reservasDaArea.length === 0 ? (
                      <p className="mt-1 text-sm text-navy-400">Nenhuma reserva futura.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {reservasDaArea.map((r) => (
                          <li key={r.id} className="flex items-center justify-between text-sm">
                            <span className="text-navy-700">
                              {new Date(`${r.data}T00:00:00`).toLocaleDateString("pt-BR")} — {r.solicitante_nome}
                              {r.unidade ? ` (unid. ${r.unidade})` : ""}
                            </span>
                            {(r.user_id === user?.id || podeGerenciar) && (
                              <button
                                onClick={() => handleCancelar(r)}
                                disabled={cancelando === r.id}
                                className="text-xs font-semibold text-coral hover:underline"
                              >
                                {cancelando === r.id ? "..." : "Cancelar"}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
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
