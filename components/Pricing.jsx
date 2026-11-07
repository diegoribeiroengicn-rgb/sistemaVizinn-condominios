"use client";

import { useEffect, useState } from "react";
import { PLANS } from "@/lib/plans";

export default function Pricing({ onSelectPlan }) {
  // Mesma fonte de dados do dashboard do síndico e do painel admin
  // (/admin/pagamentos → aba Multicondomínios) — nunca diverge do que
  // é cobrado de verdade.
  const [precoInicialMulti, setPrecoInicialMulti] = useState(null);

  useEffect(() => {
    fetch("/api/public/multicondominios-faixas")
      .then((res) => res.json())
      .then((json) => {
        const faixas = json.faixas || [];
        if (faixas.length === 0) return;
        const maisBarata = faixas.reduce((menor, f) => (Number(f.mensalidade) < Number(menor.mensalidade) ? f : menor));
        setPrecoInicialMulti(Number(maisBarata.mensalidade));
      })
      .catch(() => {});
  }, []);

  return (
    <section className="bg-navy-50/40 py-20" id="planos">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-navy-900 sm:text-4xl">
            Planos para todo tamanho de condomínio
          </h2>
          <p className="mt-4 text-navy-600">
            Comece com 14 dias grátis. Cancele quando quiser, sem multa.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`card flex flex-col ${
                plan.highlighted ? "border-2 border-coral shadow-lg" : ""
              }`}
            >
              {plan.highlighted && (
                <span className="mb-3 inline-block w-fit rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white">
                  Mais escolhido
                </span>
              )}
              <h3 className="font-display text-xl font-bold text-navy-900">
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-navy-500">{plan.description}</p>
              <p className="mt-4">
                <span className="font-display text-3xl font-bold text-navy-900">
                  R$ {plan.price}
                </span>
                <span className="text-navy-500">/mês</span>
              </p>
              <p className="text-xs text-navy-400">até {plan.unitLimit} unidades</p>

              <ul className="mt-6 flex-1 space-y-2 text-sm text-navy-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-coral">✓</span> {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onSelectPlan(plan.id)}
                className={plan.highlighted ? "btn-primary mt-8" : "btn-secondary mt-8"}
              >
                Escolher {plan.name}
              </button>
            </div>
          ))}
        </div>

        <div className="card mt-6 flex flex-col gap-6 border-navy-200 bg-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-block w-fit rounded-full bg-navy-100 px-3 py-1 text-xs font-semibold text-navy-600">
              Teste grátis por 14 dias
            </span>
            <h3 className="mt-3 font-display text-xl font-bold text-navy-900">Plataforma Multicondomínios</h3>
            <p className="mt-1 max-w-xl text-sm text-navy-500">
              Pra administradoras e síndicos profissionais que gerenciam vários condomínios: um único login,
              dashboard consolidado e gestão financeira centralizada — sem precisar de uma conta separada
              pra cada prédio.
            </p>
            <p className="mt-3">
              <span className="font-display text-2xl font-bold text-navy-900">
                A partir de R$ {precoInicialMulti != null ? precoInicialMulti.toFixed(2).replace(".", ",") : "100,00"}
              </span>
              <span className="text-navy-500">/mês</span>
            </p>
            <p className="text-xs text-navy-400">já inclui 2 condomínios de até 30 unidades cada</p>
            <ul className="mt-4 space-y-2 text-sm text-navy-700">
              <li className="flex items-center gap-2">
                <span className="text-coral">✓</span> Gestão de vários condomínios numa única conta
              </li>
              <li className="flex items-center gap-2">
                <span className="text-coral">✓</span> Dashboard consolidado com indicadores de todos os condomínios
              </li>
              <li className="flex items-center gap-2">
                <span className="text-coral">✓</span> Troque de condomínio sem precisar sair e entrar de novo
              </li>
              <li className="flex items-center gap-2">
                <span className="text-coral">✓</span> Cadastro de novos condomínios direto pelo próprio dashboard
              </li>
              <li className="flex items-center gap-2">
                <span className="text-coral">✓</span> Mensalidade progressiva — quanto mais condomínios, menor o custo por unidade
              </li>
            </ul>
          </div>
          <a href="#contato" className="btn-secondary flex-none text-center">
            Solicitar proposta comercial
          </a>
        </div>
      </div>
    </section>
  );
}
