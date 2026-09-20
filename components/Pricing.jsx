"use client";

import { PLANS } from "@/lib/plans";

export default function Pricing({ onSelectPlan }) {
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
      </div>
    </section>
  );
}
