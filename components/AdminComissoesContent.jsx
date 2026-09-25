"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/adminFetch";
import { TIPO_COMISSAO_LABELS, STATUS_COMISSAO_LABELS, STATUS_COMISSAO_STYLES } from "@/lib/comissoes";
import ValorPrivado, { BotaoAlternarValores } from "@/components/ValorPrivado";

function formatarMoeda(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PAGE_SIZE = 50;

export default function AdminComissoesContent() {
  const [resumo, setResumo] = useState(null);
  const [comissoes, setComissoes] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroCompetencia, setFiltroCompetencia] = useState("");
  const [atualizandoId, setAtualizandoId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(pagina), pageSize: String(PAGE_SIZE) });
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (filtroStatus) params.set("status", filtroStatus);
      if (filtroCompetencia) params.set("competencia", filtroCompetencia);

      const [resComissoes, resResumo] = await Promise.all([
        authedFetch(`/api/admin/comissoes?${params.toString()}`),
        authedFetch("/api/admin/comissoes/resumo"),
      ]);
      const jsonComissoes = await resComissoes.json();
      const jsonResumo = await resResumo.json();
      if (!resComissoes.ok) throw new Error(jsonComissoes.error || "Erro ao carregar comissões.");
      if (!resResumo.ok) throw new Error(jsonResumo.error || "Erro ao carregar resumo.");
      setComissoes(jsonComissoes.comissoes);
      setTotal(jsonComissoes.total);
      setResumo(jsonResumo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagina, filtroTipo, filtroStatus, filtroCompetencia]);

  useEffect(() => {
    load();
  }, [load]);

  async function marcarComoPaga(comissao) {
    const referencia = prompt("Referência do pagamento (opcional):") || undefined;
    setAtualizandoId(comissao.id);
    try {
      const res = await authedFetch(`/api/admin/comissoes/${comissao.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paga", referenciaPagamento: referencia }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao marcar como paga.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAtualizandoId(null);
    }
  }

  async function cancelar(comissao) {
    const motivo = prompt("Motivo do cancelamento:");
    if (motivo === null) return;
    setAtualizandoId(comissao.id);
    try {
      const res = await authedFetch(`/api/admin/comissoes/${comissao.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelada", motivo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao cancelar.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAtualizandoId(null);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Comissões</h1>
          <p className="mt-1 text-sm text-navy-500">
            Toda comissão gerada por venda — venda própria, indicação e liderança, com rastreabilidade completa.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BotaoAlternarValores />
          <Link href="/admin/pagamentos" className="text-sm font-semibold text-navy-600 hover:underline">
            ← Vendedores
          </Link>
        </div>
      </div>

      {resumo && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Vendas no período", resumo.vendasNoPeriodo, false],
            ["Total de adesões", formatarMoeda(resumo.valorTotalAdesoes), true],
            ["Comissões geradas", formatarMoeda(resumo.comissoesGeradas), true],
            ["Pendentes", formatarMoeda(resumo.comissoesPendentes), true],
            ["Pagas", formatarMoeda(resumo.comissoesPagas), true],
            ["Retido pelo Vizinn", formatarMoeda(resumo.valorRetidoVizinn), true],
          ].map(([label, valor, moeda]) => (
            <div key={label} className="card p-3">
              <p className="text-xs text-navy-400">{label}</p>
              <p className="mt-1 text-lg font-bold text-navy-900">
                {moeda ? <ValorPrivado valor={valor} /> : valor}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select className="input-field w-auto" value={filtroTipo} onChange={(e) => { setPagina(1); setFiltroTipo(e.target.value); }}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_COMISSAO_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="input-field w-auto" value={filtroStatus} onChange={(e) => { setPagina(1); setFiltroStatus(e.target.value); }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_COMISSAO_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input
          type="month"
          className="input-field w-auto"
          value={filtroCompetencia}
          onChange={(e) => { setPagina(1); setFiltroCompetencia(e.target.value); }}
        />
      </div>

      {error && <p className="text-sm text-coral-700">{error}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-navy-100 bg-navy-50/50 text-left text-navy-500">
            <tr>
              <th className="px-4 py-3 font-medium">Beneficiário</th>
              <th className="px-4 py-3 font-medium">Condomínio</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">%</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Competência</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {comissoes.map((c) => (
              <tr key={c.id} className="border-b border-navy-50 last:border-0">
                <td className="px-4 py-3 font-medium text-navy-900">
                  {c.beneficiario_nome}
                  {c.vendedor_venda_nome && c.vendedor_venda_nome !== c.beneficiario_nome && (
                    <span className="block text-xs font-normal text-navy-400">venda de {c.vendedor_venda_nome}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-navy-600">{c.condominio_nome}</td>
                <td className="px-4 py-3 text-navy-600">{TIPO_COMISSAO_LABELS[c.tipo] || c.tipo}</td>
                <td className="px-4 py-3 text-navy-600">{c.percentual}%</td>
                <td className="px-4 py-3 font-semibold text-navy-900">
                  <ValorPrivado valor={formatarMoeda(c.valor)} />
                </td>
                <td className="px-4 py-3 text-navy-500">{c.competencia}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COMISSAO_STYLES[c.status]}`}>
                    {STATUS_COMISSAO_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {["pendente", "gerada", "aprovada"].includes(c.status) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => marcarComoPaga(c)}
                        disabled={atualizandoId === c.id}
                        className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                      >
                        Marcar paga
                      </button>
                      <button
                        onClick={() => cancelar(c)}
                        disabled={atualizandoId === c.id}
                        className="text-xs font-semibold text-coral hover:underline disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!loading && comissoes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-navy-400">Nenhuma comissão encontrada.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-navy-400">Carregando...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-navy-500">
          <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} className="btn-ghost text-sm disabled:opacity-40">
            ← Anterior
          </button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas} className="btn-ghost text-sm disabled:opacity-40">
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
