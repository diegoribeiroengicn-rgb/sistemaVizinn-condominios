"use client";

import { useEffect, useMemo, useState } from "react";
import { PLANS } from "@/lib/plans";
import { encontrarFaixa } from "@/lib/multicondominios";

export default function Pricing({ onSelectPlan }) {
  // Mesma fonte de dados do dashboard do síndico e do painel admin
  // (/admin/pagamentos → aba Multicondomínios) — nunca diverge do que
  // é cobrado de verdade.
  const [faixasMulti, setFaixasMulti] = useState([]);
  const [numCondominios, setNumCondominios] = useState(2);

  useEffect(() => {
    fetch("/api/public/multicondominios-faixas")
      .then((res) => res.json())
      .then((json) => {
        const faixas = (json.faixas || []).slice().sort((a, b) => a.ordem - b.ordem);
        setFaixasMulti(faixas);
      })
      .catch(() => {});
  }, []);

  // Simplificação pra calculadora pública: trata "número de
  // condomínios" como a própria equivalência (vale exatamente pra
  // condomínios de até 30 unidades cada — ver calcularEquivalencia em
  // lib/multicondominios.js; prédios maiores pesam mais, por isso o
  // aviso abaixo do valor).
  const faixaEscolhida = useMemo(
    () => encontrarFaixa(Number(numCondominios) || 0, faixasMulti),
    [numCondominios, faixasMulti]
  );

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

        <div className="card mt-6 border-navy-200 bg-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
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
                <li className="flex items-center gap-2">
                  <span className="text-coral">✓</span> Pagamento via boleto ou cartão, como preferir
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-coral">✓</span> Sem taxa de adesão — só a mensalidade
                </li>
              </ul>
            </div>
          </div>

          {faixasMulti.length > 0 && (
            <div className="mt-6 border-t border-navy-100 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Calcule sua mensalidade</p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                <div>
                  <label htmlFor="num-condominios" className="text-sm text-navy-600">
                    Quantos condomínios você administra?
                  </label>
                  <input
                    id="num-condominios"
                    type="number"
                    min="2"
                    step="1"
                    className="input-field mt-1 w-32"
                    value={numCondominios}
                    onChange={(e) => setNumCondominios(e.target.value)}
                  />
                </div>
                <div>
                  {faixaEscolhida ? (
                    <p>
                      <span className="font-display text-3xl font-bold text-navy-900">
                        R$ {Number(faixaEscolhida.mensalidade).toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-navy-500">/mês</span>
                    </p>
                  ) : (
                    <p className="text-sm text-navy-400">Informe 2 ou mais condomínios pra ver o valor.</p>
                  )}
                </div>
                <a href="#contato" className="btn-primary sm:ml-auto">
                  Começar agora
                </a>
              </div>
              <p className="mt-3 text-xs text-navy-400">
                Considerando condomínios de até 30 unidades cada. Prédios maiores contam como mais de uma unidade
                equivalente — o valor exato é confirmado na ativação da sua conta.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
