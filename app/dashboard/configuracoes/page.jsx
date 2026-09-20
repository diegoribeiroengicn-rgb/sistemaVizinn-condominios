"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getPlan } from "@/lib/plans";
import { supabase } from "@/lib/supabase";

export default function ConfiguracoesPage() {
  const { user, condominio, role, refreshCondominio } = useAuth();
  const plan = getPlan(condominio?.plano);
  const [alertaDias, setAlertaDias] = useState(condominio?.manutencao_alerta_dias_padrao ?? 7);
  const [salvandoAlerta, setSalvandoAlerta] = useState(false);
  const [alertaSalvo, setAlertaSalvo] = useState(false);
  const [salvandoDistribuicao, setSalvandoDistribuicao] = useState(false);

  async function salvarAlertaPadrao() {
    if (!condominio?.id) return;
    setSalvandoAlerta(true);
    setAlertaSalvo(false);
    const { error } = await supabase
      .from("condominios")
      .update({ manutencao_alerta_dias_padrao: Number(alertaDias) || 7 })
      .eq("id", condominio.id);
    setSalvandoAlerta(false);
    if (!error) {
      setAlertaSalvo(true);
      refreshCondominio();
    }
  }

  async function alternarDistribuicaoAutomatica(ativar) {
    if (!condominio?.id) return;
    setSalvandoDistribuicao(true);
    const { error } = await supabase
      .from("condominios")
      .update({ chamados_distribuicao_automatica: ativar })
      .eq("id", condominio.id);
    setSalvandoDistribuicao(false);
    if (!error) refreshCondominio();
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="font-display text-xl font-bold text-navy-900">Configurações</h1>
        <p className="mt-2 text-navy-500">
          Dados da conta e do condomínio. Edição completa em breve.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy-900">Conta</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-navy-400">E-mail</dt>
            <dd className="text-navy-800">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-navy-400">Responsável</dt>
            <dd className="text-navy-800">{condominio?.responsavel_nome || "-"}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy-900">Condomínio</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-navy-400">Nome</dt>
            <dd className="text-navy-800">{condominio?.nome || "-"}</dd>
          </div>
          <div>
            <dt className="text-navy-400">CNPJ</dt>
            <dd className="text-navy-800">{condominio?.cnpj || "-"}</dd>
          </div>
          <div>
            <dt className="text-navy-400">Endereço</dt>
            <dd className="text-navy-800">{condominio?.endereco || "-"}</dd>
          </div>
          <div>
            <dt className="text-navy-400">Plano</dt>
            <dd className="text-navy-800">
              {plan.name} — R$ {plan.price}/mês
            </dd>
          </div>
        </dl>
      </div>

      {role === "sindico" && (
        <div className="card">
          <h2 className="font-semibold text-navy-900">Alertas de manutenção</h2>
          <p className="mt-1 text-sm text-navy-500">
            Com quantos dias de antecedência avisar sobre uma manutenção prevista, por padrão. Cada
            manutenção pode sobrescrever esse valor individualmente.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="number"
              min="1"
              className="input-field w-24"
              value={alertaDias}
              onChange={(e) => setAlertaDias(e.target.value)}
            />
            <span className="text-sm text-navy-500">dias antes</span>
            <button onClick={salvarAlertaPadrao} disabled={salvandoAlerta} className="btn-secondary">
              {salvandoAlerta ? "Salvando..." : "Salvar"}
            </button>
            {alertaSalvo && <span className="text-sm text-emerald-700">Salvo.</span>}
          </div>
        </div>
      )}

      {role === "sindico" && (
        <div className="card">
          <h2 className="font-semibold text-navy-900">Distribuição automática de chamados</h2>
          <p className="mt-1 text-sm text-navy-500">
            Quando ligada, um chamado de condomínio criado sem colaborador escolhido manualmente é
            atribuído automaticamente a quem tem menos chamados em aberto no momento. Nunca é
            obrigatório — escolher o responsável na hora de criar continua funcionando normalmente.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-navy-700">
            <input
              type="checkbox"
              checked={Boolean(condominio?.chamados_distribuicao_automatica)}
              disabled={salvandoDistribuicao}
              onChange={(e) => alternarDistribuicaoAutomatica(e.target.checked)}
            />
            Ativar distribuição automática
          </label>
        </div>
      )}
    </div>
  );
}
