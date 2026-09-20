"use client";

import { useAuth } from "@/hooks/useAuth";
import { getPlan } from "@/lib/plans";

export default function ConfiguracoesPage() {
  const { user, condominio } = useAuth();
  const plan = getPlan(condominio?.plano);

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
    </div>
  );
}
