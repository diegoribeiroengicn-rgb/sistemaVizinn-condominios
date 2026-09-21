"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { formatarCnpj } from "@/lib/validacaoDocumentos";
import AdminFornecedorGlobalModal from "@/components/AdminFornecedorGlobalModal";

const STATUS_STYLES = {
  ativo: "bg-emerald-100 text-emerald-700",
  inativo: "bg-navy-100 text-navy-500",
};

export default function AdminFornecedoresContent() {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [selecionadoId, setSelecionadoId] = useState(null);

  const load = useCallback(async (termo) => {
    setLoading(true);
    setError("");
    try {
      const params = termo ? `?q=${encodeURIComponent(termo)}` : "";
      const res = await authedFetch(`/api/admin/fornecedores-globais${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar fornecedores.");
      setFornecedores(json.fornecedores);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleBuscar(e) {
    e.preventDefault();
    load(q);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Base geral de Fornecedores</h1>
          <p className="mt-1 text-sm text-navy-500">
            Identidade única por CNPJ, compartilhada entre condomínios — o Ecossistema de
            Fornecedores Vizinn.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-navy-600 hover:underline">
          ← Painel administrativo
        </Link>
      </div>

      <form onSubmit={handleBuscar} className="flex gap-3">
        <input
          className="input-field flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou CNPJ..."
        />
        <button type="submit" className="btn-primary">
          Buscar
        </button>
      </form>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      {loading ? (
        <p className="text-navy-500">Carregando...</p>
      ) : fornecedores.length === 0 ? (
        <div className="card text-center text-navy-400">Nenhum fornecedor encontrado na base geral.</div>
      ) : (
        <div className="space-y-2">
          {fornecedores.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelecionadoId(f.id)}
              className="card flex w-full flex-wrap items-center justify-between gap-2 text-left transition hover:border-navy-300"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{f.razao_social}</h3>
                  {f.nome_fantasia && <span className="text-sm text-navy-500">({f.nome_fantasia})</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[f.status]}`}>
                    {f.status === "ativo" ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-navy-400">
                  {[
                    (f.categorias?.length ? f.categorias : [f.categoria].filter(Boolean)).join(", "),
                    f.cnpj && formatarCnpj(f.cnpj),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-600">
                {f.total_condominios} condomínio{f.total_condominios === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      )}

      {selecionadoId && (
        <AdminFornecedorGlobalModal
          fornecedorId={selecionadoId}
          onClose={() => setSelecionadoId(null)}
          onChanged={() => load(q)}
        />
      )}
    </div>
  );
}
