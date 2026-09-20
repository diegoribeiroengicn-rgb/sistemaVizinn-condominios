"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import ModuloGuard from "@/components/ModuloGuard";
import { useAvisoSaidaSemSalvar } from "@/hooks/useAvisoSaidaSemSalvar";

const TIPO_LABELS = {
  visitante: "Visitante",
  entregador: "Entregador",
  prestador_servico: "Prestador de serviço",
  morador: "Morador",
  outro: "Outro",
};

const emptyForm = {
  nomePessoa: "",
  tipoAcesso: "visitante",
  unidade: "",
  formaEntrada: "a_pe",
  placaVeiculo: "",
  observacoes: "",
};

const emptyFiltro = {
  pessoa: "",
  unidade: "",
  placa: "",
  tipo: "",
  status: "",
  data: "",
};

export default function PortariaPage() {
  const { condominio, user, member, temPermissao } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  useAvisoSaidaSemSalvar(form, emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [saindoId, setSaindoId] = useState(null);
  const [filtro, setFiltro] = useState(emptyFiltro);

  const podeCriar = temPermissao("portaria", "criar");
  const podeEditar = temPermissao("portaria", "editar");
  const registradoPor = member?.nome || user?.user_metadata?.full_name || user?.email || "Síndico";

  const load = useCallback(async () => {
    if (!condominio?.id) return;
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("portaria_registros")
      .select("*")
      .eq("condominio_id", condominio.id)
      .order("entrada_em", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setRegistros(data || []);
    setLoading(false);
  }, [condominio?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!condominio?.id || !form.nomePessoa.trim()) return;
    if (form.formaEntrada === "carro" && !form.placaVeiculo.trim()) {
      setError("Informe a placa do veículo.");
      return;
    }

    setSubmitting(true);
    setError("");
    const { error: insertError } = await supabase.from("portaria_registros").insert({
      condominio_id: condominio.id,
      nome_pessoa: form.nomePessoa.trim(),
      tipo_acesso: form.tipoAcesso,
      unidade: form.unidade.trim() || null,
      forma_entrada: form.formaEntrada,
      placa_veiculo: form.formaEntrada === "carro" ? form.placaVeiculo.trim().toUpperCase() : null,
      observacoes: form.observacoes.trim() || null,
      entrada_por: registradoPor,
      entrada_por_id: user?.id || null,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    load();
  }

  async function handleSaida(registro) {
    setSaindoId(registro.id);
    const { error: updateError } = await supabase
      .from("portaria_registros")
      .update({
        saida_em: new Date().toISOString(),
        saida_por: registradoPor,
        saida_por_id: user?.id || null,
      })
      .eq("id", registro.id);
    setSaindoId(null);
    if (updateError) setError(updateError.message);
    else load();
  }

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtro.pessoa && !r.nome_pessoa.toLowerCase().includes(filtro.pessoa.toLowerCase())) return false;
      if (filtro.unidade && !(r.unidade || "").toLowerCase().includes(filtro.unidade.toLowerCase()))
        return false;
      if (filtro.placa && !(r.placa_veiculo || "").toLowerCase().includes(filtro.placa.toLowerCase()))
        return false;
      if (filtro.tipo && r.tipo_acesso !== filtro.tipo) return false;
      if (filtro.status === "dentro" && r.saida_em) return false;
      if (filtro.status === "saiu" && !r.saida_em) return false;
      if (filtro.data && !r.entrada_em.startsWith(filtro.data)) return false;
      return true;
    });
  }, [registros, filtro]);

  const dentroAgora = useMemo(() => registros.filter((r) => !r.saida_em).length, [registros]);

  if (!condominio) {
    return <p className="text-navy-500">Carregando condomínio...</p>;
  }

  return (
    <ModuloGuard modulo="portaria">
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">Portaria</h1>
        <p className="mt-1 text-sm text-navy-500">
          Registro de entrada e saída de visitantes, entregas e prestadores.{" "}
          <strong className="text-navy-700">{dentroAgora}</strong>{" "}
          {dentroAgora === 1 ? "pessoa dentro" : "pessoas dentro"} agora.
        </p>
      </div>

      {podeCriar && (
        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-900">Registrar entrada</h2>
          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field">Nome da pessoa</label>
              <input
                className="input-field"
                value={form.nomePessoa}
                onChange={(e) => setForm((f) => ({ ...f, nomePessoa: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label-field">Unidade relacionada</label>
              <input
                className="input-field"
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                placeholder="Ex: Apto 32"
              />
            </div>
            <div>
              <label className="label-field">Tipo de acesso</label>
              <select
                className="input-field"
                value={form.tipoAcesso}
                onChange={(e) => setForm((f) => ({ ...f, tipoAcesso: e.target.value }))}
              >
                {Object.entries(TIPO_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Forma de entrada</label>
              <select
                className="input-field"
                value={form.formaEntrada}
                onChange={(e) => setForm((f) => ({ ...f, formaEntrada: e.target.value }))}
              >
                <option value="a_pe">A pé</option>
                <option value="carro">De carro</option>
              </select>
            </div>
            {form.formaEntrada === "carro" && (
              <div>
                <label className="label-field">Placa do veículo</label>
                <input
                  className="input-field uppercase"
                  value={form.placaVeiculo}
                  onChange={(e) => setForm((f) => ({ ...f, placaVeiculo: e.target.value }))}
                  placeholder="ABC1D23"
                  required
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label-field">Observações (opcional)</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Registrando..." : "Registrar entrada"}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-coral-700">{error}</p>}

      <div className="card">
        <h2 className="font-display text-lg font-bold text-navy-900">Histórico</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input
            className="input-field"
            placeholder="Pessoa"
            value={filtro.pessoa}
            onChange={(e) => setFiltro((f) => ({ ...f, pessoa: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Unidade"
            value={filtro.unidade}
            onChange={(e) => setFiltro((f) => ({ ...f, unidade: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Placa"
            value={filtro.placa}
            onChange={(e) => setFiltro((f) => ({ ...f, placa: e.target.value }))}
          />
          <select
            className="input-field"
            value={filtro.tipo}
            onChange={(e) => setFiltro((f) => ({ ...f, tipo: e.target.value }))}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input-field"
            value={filtro.status}
            onChange={(e) => setFiltro((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Dentro e fora</option>
            <option value="dentro">Só quem está dentro</option>
            <option value="saiu">Só quem já saiu</option>
          </select>
          <input
            type="date"
            className="input-field"
            value={filtro.data}
            onChange={(e) => setFiltro((f) => ({ ...f, data: e.target.value }))}
          />
        </div>

        {loading ? (
          <p className="mt-4 text-navy-500">Carregando registros...</p>
        ) : registrosFiltrados.length === 0 ? (
          <div className="mt-4 text-center text-navy-400">Nenhum registro encontrado.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-navy-100 text-left text-navy-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Pessoa</th>
                  <th className="px-3 py-2 font-medium">Unidade</th>
                  <th className="px-3 py-2 font-medium">Entrada</th>
                  <th className="px-3 py-2 font-medium">Saída</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Veículo</th>
                  <th className="px-3 py-2 font-medium">Placa</th>
                  <th className="px-3 py-2 font-medium">Registrado por</th>
                  {podeEditar && <th className="px-3 py-2 font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.map((r) => (
                  <tr key={r.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-3 py-2 font-medium text-navy-900">{r.nome_pessoa}</td>
                    <td className="px-3 py-2 text-navy-600">{r.unidade || "-"}</td>
                    <td className="px-3 py-2 text-navy-600">
                      {new Date(r.entrada_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-navy-600">
                      {r.saida_em ? (
                        new Date(r.saida_em).toLocaleString("pt-BR")
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Dentro
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-navy-600">{TIPO_LABELS[r.tipo_acesso]}</td>
                    <td className="px-3 py-2 text-navy-600">
                      {r.forma_entrada === "carro" ? "Carro" : "A pé"}
                    </td>
                    <td className="px-3 py-2 text-navy-600">{r.placa_veiculo || "-"}</td>
                    <td className="px-3 py-2 text-navy-600">{r.entrada_por || "-"}</td>
                    {podeEditar && (
                      <td className="px-3 py-2">
                        {!r.saida_em && (
                          <button
                            onClick={() => handleSaida(r)}
                            disabled={saindoId === r.id}
                            className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                          >
                            {saindoId === r.id ? "..." : "Registrar saída"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </ModuloGuard>
  );
}
