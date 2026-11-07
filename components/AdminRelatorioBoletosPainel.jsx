"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import ValorPrivado, { BotaoAlternarValores } from "@/components/ValorPrivado";

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

// Relatório interno de boletos e tarifa de cobrança (seção 8.1 do prompt
// de upgrade) — plataforma admin only, nunca exposto a síndico/condômino.
export default function AdminRelatorioBoletosPainel() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await authedFetch("/api/admin/relatorio-boletos");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar relatório de boletos.");
        if (ativo) setDados(json);
      } catch (err) {
        if (ativo) setErro(err.message);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) return <div className="card"><p className="text-sm text-coral-700">{erro}</p></div>;
  if (!dados) return <div className="card"><p className="text-sm text-navy-400">Carregando relatório de boletos...</p></div>;

  const { totais, porCondominio } = dados;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">Boletos e tarifa de cobrança</h2>
        <BotaoAlternarValores />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <p className="text-xs text-navy-400">Boletos emitidos</p>
          <p className="font-display text-xl font-bold text-navy-900">{totais.boletosEmitidos}</p>
        </div>
        <div>
          <p className="text-xs text-navy-400">Boletos pagos</p>
          <p className="font-display text-xl font-bold text-navy-900">{totais.boletosPagos}</p>
        </div>
        <div>
          <p className="text-xs text-navy-400">Recebido (boleto)</p>
          <p className="font-display text-xl font-bold text-navy-900"><ValorPrivado valor={formatBRL(totais.valorRecebido)} /></p>
        </div>
        <div>
          <p className="text-xs text-navy-400">Tarifa cobrada</p>
          <p className="font-display text-xl font-bold text-navy-900"><ValorPrivado valor={formatBRL(totais.tarifaCobrada)} /></p>
        </div>
        <div>
          <p className="text-xs text-navy-400">Resultado (crédito/débito)</p>
          <p className={`font-display text-xl font-bold ${totais.diferenca >= 0 ? "text-emerald-600" : "text-coral-700"}`}>
            <ValorPrivado valor={formatBRL(totais.diferenca)} />
          </p>
        </div>
      </div>

      {totais.boletosEmitidos > 0 && totais.tarifaCobrada === 0 && totais.custoOperacional === 0 && (
        <p className="mb-4 text-xs text-navy-400">
          Nenhum lançamento de tarifa ainda — a cobrança da tarifa na emissão real do boleto está pendente de validação.
        </p>
      )}

      {porCondominio.length === 0 ? (
        <p className="text-sm text-navy-400">Nenhum boleto emitido ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-left text-xs text-navy-400">
                <th className="py-2 pr-3">Condomínio</th>
                <th className="py-2 pr-3">Emitidos</th>
                <th className="py-2 pr-3">Pagos</th>
                <th className="py-2 pr-3">Recebido</th>
                <th className="py-2 pr-3">Tarifa cobrada</th>
                <th className="py-2 pr-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {porCondominio.map((l) => (
                <tr key={l.condominioId} className="border-b border-navy-50">
                  <td className="py-2 pr-3 text-navy-900">{l.nome}</td>
                  <td className="py-2 pr-3 text-navy-600">{l.boletosEmitidos}</td>
                  <td className="py-2 pr-3 text-navy-600">{l.boletosPagos}</td>
                  <td className="py-2 pr-3 text-navy-600"><ValorPrivado valor={formatBRL(l.valorRecebido)} /></td>
                  <td className="py-2 pr-3 text-navy-600"><ValorPrivado valor={formatBRL(l.tarifaCobrada)} /></td>
                  <td className={`py-2 pr-3 font-semibold ${l.diferenca >= 0 ? "text-emerald-600" : "text-coral-700"}`}>
                    <ValorPrivado valor={formatBRL(l.diferenca)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
