"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { vendedorFetch } from "@/lib/vendedorFetch";
import { ValoresVisiveisProvider } from "@/hooks/useValoresVisiveis";
import ValorPrivado, { BotaoAlternarValores } from "@/components/ValorPrivado";
import { TIPO_COMISSAO_LABELS, STATUS_COMISSAO_LABELS, STATUS_COMISSAO_STYLES } from "@/lib/comissoes";

function formatBRL(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PainelVendedor() {
  const router = useRouter();
  const [detalhe, setDetalhe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/vendedor/login");
        return;
      }
      const res = await vendedorFetch("/api/vendedor/me");
      if (res.status === 401 || res.status === 403) {
        await supabase.auth.signOut();
        router.replace("/vendedor/login");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar seu painel.");
      setDetalhe(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/vendedor/login");
  }

  function copiarLink(link) {
    navigator.clipboard?.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-navy-500">Carregando...</p></div>;
  if (error) return <div className="flex min-h-screen items-center justify-center"><p className="text-coral-700">{error}</p></div>;
  if (!detalhe) return null;

  const linkVenda = `${window.location.origin}/?ref=${detalhe.vendedor.codigo_indicacao}`;
  const linkConvite = `${window.location.origin}/vendedor/convite/${detalhe.vendedor.codigo_indicacao}`;

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-navy-900">Olá, {detalhe.vendedor.nome}</h1>
            <p className="mt-1 text-sm text-navy-500">Seu painel de vendas, comissões e equipe.</p>
          </div>
          <div className="flex items-center gap-3">
            <BotaoAlternarValores />
            <button onClick={sair} className="text-sm font-semibold text-navy-600 hover:underline">Sair</button>
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-navy-800">Meu link de venda</h2>
            <p className="mt-1 text-xs text-navy-500">
              Compartilhe com síndicos interessados no Vizinn. Quem se cadastrar por esse link vira sua venda
              automaticamente, sem precisar de cupom.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="flex-1 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-700">{linkVenda}</code>
              <button onClick={() => copiarLink(linkVenda)} className="btn-primary text-sm">
                {copiado ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-navy-800">Meu link de convite de vendedor</h2>
            <p className="mt-1 text-xs text-navy-500">
              Compartilhe com quem você quer indicar como novo vendedor Vizinn. Na primeira venda dele, você recebe
              sua bonificação de indicação.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="flex-1 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-700">{linkConvite}</code>
              <button onClick={() => copiarLink(linkConvite)} className="btn-primary text-sm">
                {copiado ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-3">
            <p className="text-xs text-navy-400">Vendas (total)</p>
            <p className="text-lg font-bold text-navy-900">{detalhe.vendas.quantidade}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-navy-400">Vendas no mês</p>
            <p className="text-lg font-bold text-navy-900">{detalhe.vendas.vendasDoMes}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-navy-400">Comissão total</p>
            <p className="text-lg font-bold text-navy-900"><ValorPrivado valor={formatBRL(detalhe.comissoes.total)} /></p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-navy-400">Pendente</p>
            <p className="text-lg font-bold text-amber-700"><ValorPrivado valor={formatBRL(detalhe.comissoes.pendente)} /></p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-navy-800">
            Painel de progresso — liderança ({detalhe.painelProgresso.competencia})
          </h2>
          <p className="mt-1 text-sm text-navy-600">
            Minhas vendas no mês: <strong>{detalhe.painelProgresso.minhasVendas}</strong> / {detalhe.painelProgresso.metaLider}
          </p>
          {detalhe.painelProgresso.totalDiretos > 0 ? (
            <>
              <p className="text-sm text-navy-600">Equipe: <strong>{detalhe.painelProgresso.totalDiretos}</strong> vendedor(es)</p>
              <p className="text-sm text-navy-600">Necessários com meta batida: <strong>{detalhe.painelProgresso.necessariosComMeta}</strong></p>
              <p className="text-sm text-navy-600">Atualmente: <strong>{detalhe.painelProgresso.atualmenteComMeta}</strong></p>
              <p className="text-sm text-navy-600">Restantes: <strong>{detalhe.painelProgresso.restantes}</strong></p>
            </>
          ) : (
            <p className="text-sm text-navy-400">Você ainda não tem vendedores diretos na sua equipe.</p>
          )}
          <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            detalhe.painelProgresso.situacao?.qualificado ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
          }`}>
            {detalhe.painelProgresso.situacao?.qualificado ? "QUALIFICADO" : "NÃO QUALIFICADO"}
          </p>
          {detalhe.painelProgresso.situacao?.motivo && (
            <p className="mt-1 text-xs text-navy-400">{detalhe.painelProgresso.situacao.motivo}</p>
          )}
        </div>

        {detalhe.equipe.totalDiretos > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-navy-800">Minha equipe direta ({detalhe.equipe.totalDiretos})</h2>
            <p className="mt-1 text-xs text-navy-500">
              {detalhe.equipe.comMeta} com meta batida · {detalhe.equipe.com1ou2} com 1-2 vendas · {detalhe.equipe.semVenda} sem venda
            </p>
            <ul className="mt-2 space-y-1">
              {detalhe.equipe.diretos.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm text-navy-600">
                  <span>{d.nome}</span>
                  <span className="text-xs font-semibold text-navy-500">{d.vendas_mes} venda(s) no mês</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card">
          <h2 className="text-sm font-semibold text-navy-800">Minhas comissões</h2>
          <div className="mt-2 space-y-1">
            {detalhe.comissoes.historico
              .filter((c) => c.vendedor_beneficiario_id === detalhe.vendedor.id)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-navy-50 py-1.5 text-sm last:border-0">
                  <span className="text-navy-600">{TIPO_COMISSAO_LABELS[c.tipo]} · {c.competencia} · {c.percentual}%</span>
                  <span className="flex items-center gap-2">
                    <ValorPrivado valor={formatBRL(c.valor)} className="font-semibold text-navy-900" />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COMISSAO_STYLES[c.status]}`}>
                      {STATUS_COMISSAO_LABELS[c.status]}
                    </span>
                  </span>
                </div>
              ))}
            {detalhe.comissoes.historico.filter((c) => c.vendedor_beneficiario_id === detalhe.vendedor.id).length === 0 && (
              <p className="text-sm text-navy-400">Nenhuma comissão ainda.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VendedorDashboardPage() {
  return (
    <ValoresVisiveisProvider>
      <PainelVendedor />
    </ValoresVisiveisProvider>
  );
}
