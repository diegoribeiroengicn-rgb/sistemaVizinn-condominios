"use client";

const bullets = [
  "Notificações automáticas por WhatsApp e e-mail",
  "Portal do condômino 24/7",
  "Relatórios em PDF e Word",
  "Sem intermediários",
];

export default function LandingHero({ onStart }) {
  return (
    <section className="relative overflow-hidden bg-midnight">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-coral/20 blur-3xl" />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
        <div className="relative z-10">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-cream-100">
            Gestão Condominial Inteligente
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
            Simplifique a administração do seu condomínio
          </h1>
          <p className="mt-5 max-w-xl text-lg text-cream-100/80">
            A Vizinn reúne financeiro, comunicação e atendimento em um só lugar,
            para síndicos que querem gastar menos tempo com burocracia.
          </p>

          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-2 text-cream-50">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-coral text-xs text-white">
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-start gap-3">
            <p className="text-2xl font-semibold text-white">
              A partir de <span className="text-coral">R$ 49</span>/mês
            </p>
            <button onClick={onStart} className="btn-primary px-8 py-4 text-base">
              Começar 14 dias grátis
            </button>
            <p className="text-sm text-cream-100/60">
              Cobrança inicial de apenas R$ 1 para validar o cartão
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-center">
          <div className="card w-full max-w-sm border-transparent bg-white/95">
            <p className="text-sm font-medium text-gray-500">Resumo do mês</p>
            <p className="mt-1 font-display text-2xl font-bold text-midnight">
              Vila Mariana
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400">Arrecadação</p>
                <p className="text-lg font-semibold text-midnight">R$ 42.300</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Inadimplência</p>
                <p className="text-lg font-semibold text-coral">3,2%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Moradores cadastrados</p>
                <p className="text-lg font-semibold text-midnight">128</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Chamados abertos</p>
                <p className="text-lg font-semibold text-midnight">4</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
