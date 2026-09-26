"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { getPlan } from "@/lib/plans";
import { isCondominioAtivo } from "@/lib/condominios";
import AdminManageModal from "@/components/AdminManageModal";

// Sem paginação por clique: carrega tudo de uma vez e a lista inteira
// fica visível rolando a página, um condomínio embaixo do outro.
const PAGE_SIZE = 2000;

const STATUS_LABELS = {
  active: "Ativo",
  trialing: "Em teste",
  canceled: "Cancelado",
  past_due: "Pagamento pendente",
  unpaid: "Inadimplente",
  incomplete: "Incompleto",
  incomplete_expired: "Expirado",
  suspended: "Suspenso",
  promessa: "Promessa de pagamento",
  cortesia: "Cortesia",
};

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-amber-100 text-amber-700",
  canceled: "bg-navy-100 text-navy-500",
  past_due: "bg-coral-100 text-coral-700",
  unpaid: "bg-coral-100 text-coral-700",
  suspended: "bg-coral-100 text-coral-700",
  promessa: "bg-sky-100 text-sky-700",
  cortesia: "bg-violet-100 text-violet-700",
};

// Listagem/busca de TODOS os condomínios da plataforma — paginada e
// buscada direto no banco (ver /api/admin/condominios-buscar), nunca
// carrega a base inteira no navegador pra filtrar. Antes vivia dentro
// da Visão Geral (embaixo dos KPIs); agora é aba própria, pra escalar
// bem conforme o número de condomínios cresce.
export default function AdminCondominiosContent() {
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [listaCondominios, setListaCondominios] = useState([]);
  const [totalCondominiosBusca, setTotalCondominiosBusca] = useState(0);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [managing, setManaging] = useState(null);

  const loadLista = useCallback(async (termo, page) => {
    setCarregandoLista(true);
    setErroLista("");
    try {
      // POST em vez de GET de propósito — nenhum cache no meio do
      // caminho (CDN, proxy) guarda resposta de POST por padrão,
      // mesmo que ignore o header Cache-Control pra GET.
      const res = await authedFetch(`/api/admin/condominios-buscar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, pageSize: PAGE_SIZE, q: termo || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao buscar condomínios.");
      setListaCondominios(json.itens);
      setTotalCondominiosBusca(json.total);
    } catch (err) {
      setErroLista(err.message);
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  useEffect(() => {
    loadLista(buscaAplicada, pagina);
  }, [loadLista, buscaAplicada, pagina]);

  function handleBuscarCondominios(e) {
    e.preventDefault();
    setPagina(1);
    setBuscaAplicada(busca.trim());
  }

  const totalPaginas = Math.max(1, Math.ceil(totalCondominiosBusca / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-navy-900">
          Condomínios ({totalCondominiosBusca})
        </h1>
        <p className="mt-1 text-sm text-navy-500">Todos os condomínios cadastrados na Vizinn.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleBuscarCondominios} className="flex flex-1 gap-3">
          <input
            className="input-field flex-1"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CNPJ (com ou sem pontuação)..."
          />
          <button type="submit" className="btn-primary text-sm">
            Buscar
          </button>
          {buscaAplicada && (
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => {
                setBusca("");
                setPagina(1);
                setBuscaAplicada("");
              }}
            >
              Limpar
            </button>
          )}
        </form>
        <button onClick={() => loadLista(buscaAplicada, pagina)} className="btn-ghost text-sm">
          Atualizar
        </button>
      </div>

      {erroLista && <p className="text-sm text-coral-700">{erroLista}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-navy-100 bg-navy-50/50 text-left text-navy-500">
            <tr>
              <th className="px-4 py-3 font-medium">Condomínio</th>
              <th className="px-4 py-3 font-medium">CNPJ</th>
              <th className="px-4 py-3 font-medium">Responsável</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Unidades</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaCondominios.map((c) => {
              const ativo = isCondominioAtivo(c.status);
              return (
                <tr key={c.id} className="border-b border-navy-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-navy-900">
                    {c.nome}
                    {c.pro_plus_multicondominios && (
                      <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        Pro+
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy-600">{c.cnpj || "-"}</td>
                  <td className="px-4 py-3 text-navy-600">
                    {c.responsavel_nome || "-"}
                    <br />
                    <span className="text-xs text-navy-400">{c.owner_email}</span>
                  </td>
                  <td className="px-4 py-3 text-navy-600">{getPlan(c.plano).name}</td>
                  <td className="px-4 py-3 text-navy-600">
                    {c.unidades_ativas ?? 0}/{c.unidades_limite}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          ativo ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-emerald-600" : "bg-navy-400"}`} />
                        {ativo ? "ATIVO" : "INATIVO"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[c.status] || "bg-navy-100 text-navy-500"
                        }`}
                      >
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setManaging(c)}
                      className="text-xs font-semibold text-coral hover:underline"
                    >
                      Gerenciar
                    </button>
                  </td>
                </tr>
              );
            })}
            {!carregandoLista && listaCondominios.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-navy-400">
                  {buscaAplicada
                    ? "Nenhum condomínio encontrado com esse nome/CNPJ."
                    : "Nenhum condomínio cadastrado ainda."}
                </td>
              </tr>
            )}
            {carregandoLista && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-navy-400">
                  Carregando...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

      {managing && (
        <AdminManageModal
          condominio={managing}
          onClose={() => setManaging(null)}
          onChanged={async () => {
            setManaging(null);
            await loadLista(buscaAplicada, pagina);
          }}
        />
      )}
    </div>
  );
}
