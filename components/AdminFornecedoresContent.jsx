"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { formatarCnpj } from "@/lib/validacaoDocumentos";
import AdminFornecedorGlobalModal from "@/components/AdminFornecedorGlobalModal";
import AdminFornecedorGlobalCriarModal from "@/components/AdminFornecedorGlobalCriarModal";
import BolinhasDestaqueComercial from "@/components/BolinhasDestaqueComercial";

const STATUS_STYLES = {
  ativo: "bg-emerald-100 text-emerald-700",
  inativo: "bg-navy-100 text-navy-500",
};

// Sem paginação por clique: carrega tudo de uma vez e a lista inteira
// fica visível rolando a página, um fornecedor embaixo do outro.
const PAGE_SIZE = 2000;

export default function AdminFornecedoresContent() {
  const [fornecedores, setFornecedores] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [criando, setCriando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [resultadoVinculo, setResultadoVinculo] = useState("");

  const load = useCallback(async (termo, page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (termo) params.set("q", termo);
      const res = await authedFetch(`/api/admin/fornecedores-globais?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar fornecedores.");
      setFornecedores(json.fornecedores);
      setTotal(json.total ?? json.fornecedores.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(buscaAplicada, pagina);
  }, [load, buscaAplicada, pagina]);

  function handleBuscar(e) {
    e.preventDefault();
    setPagina(1);
    setBuscaAplicada(q.trim());
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleVincular() {
    setVinculando(true);
    setResultadoVinculo("");
    setError("");
    try {
      const res = await authedFetch("/api/admin/fornecedores-globais/backfill", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao vincular fornecedores.");
      setResultadoVinculo(`${json.vinculados} fornecedor(es) vinculado(s) à base geral.`);
      load(buscaAplicada, pagina);
    } catch (err) {
      setError(err.message);
    } finally {
      setVinculando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">
            Base geral de Fornecedores ({total})
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Identidade única por CNPJ, compartilhada entre condomínios — o Ecossistema de
            Fornecedores Vizinn.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-navy-600 hover:underline">
          ← Painel administrativo
        </Link>
      </div>

      <form onSubmit={handleBuscar} className="flex flex-wrap gap-3">
        <input
          className="input-field flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou CNPJ..."
        />
        <button type="submit" className="btn-primary">
          Buscar
        </button>
        <button type="button" onClick={() => setCriando(true)} className="btn-primary whitespace-nowrap">
          + Novo fornecedor
        </button>
        <button
          type="button"
          onClick={handleVincular}
          disabled={vinculando}
          className="btn-ghost whitespace-nowrap text-sm disabled:opacity-50"
          title="Vincula fornecedores locais dos condomínios (com CNPJ válido) que ainda não estão na base geral"
        >
          {vinculando ? "Vinculando..." : "Vincular fornecedores locais"}
        </button>
      </form>

      {resultadoVinculo && <p className="text-sm font-medium text-emerald-700">{resultadoVinculo}</p>}
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
              <div className="flex items-center gap-3">
                <BolinhasDestaqueComercial nivel={f.nivel_destaque} tamanho="text-xs" />
                <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-600">
                  {f.total_condominios} condomínio{f.total_condominios === 1 ? "" : "s"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-navy-500">
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina >= totalPaginas}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}

      {selecionadoId && (
        <AdminFornecedorGlobalModal
          fornecedorId={selecionadoId}
          onClose={() => setSelecionadoId(null)}
          onChanged={() => load(buscaAplicada, pagina)}
        />
      )}

      {criando && (
        <AdminFornecedorGlobalCriarModal
          onClose={() => setCriando(false)}
          onCreated={() => load(buscaAplicada, pagina)}
        />
      )}
    </div>
  );
}
